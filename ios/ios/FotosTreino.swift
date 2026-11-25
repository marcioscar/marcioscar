import ImageIO
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

// MARK: - Fotos ligadas a treinos e provas
// O arquivo fica no servidor (protegido pelo token); no iPhone só um cache que o iOS pode limpar.

struct FotoTreino: Codable, Identifiable, Hashable {
    var id: String
    var chave: String
    var tiradaEm: String?
    var criadaEm: String

    /// na ordem em que foram tiradas
    var ordem: String { tiradaEm ?? criadaEm }
}

extension Maratona {
    /// as maratonas do relógio já usam o id do treino no Saúde
    var chaveFotos: String { stravaId != 0 ? "strava-\(id)" : id }
}

extension Servidor {
    static func listarFotosTreino() async throws -> [FotoTreino] {
        struct Resposta: Decodable { var fotos: [FotoTreino] }
        return try JSONDecoder().decode(Resposta.self, from: try await executar(try requisicao("api/fotos-treino"))).fotos
    }

    static func baixarFotoTreino(id: String, miniatura: Bool) async throws -> Data {
        try await executar(try requisicaoFoto("GET", [URLQueryItem(name: "id", value: id)] + (miniatura ? [URLQueryItem(name: "mini", value: "1")] : [])))
    }

    static func enviarFotoTreino(chave: String, jpeg: Data, tiradaEm: Date?) async throws -> FotoTreino {
        struct Resposta: Decodable { var foto: FotoTreino }
        var itens = [URLQueryItem(name: "chave", value: chave)]
        if let tiradaEm { itens.append(URLQueryItem(name: "tiradaEm", value: ISO8601DateFormatter().string(from: tiradaEm))) }
        var req = try requisicaoFoto("POST", itens)
        req.timeoutInterval = 120
        req.setValue("image/jpeg", forHTTPHeaderField: "Content-Type")
        req.httpBody = jpeg
        return try JSONDecoder().decode(Resposta.self, from: try await executar(req)).foto
    }

    static func apagarFotoTreino(id: String) async throws {
        _ = try await executar(try requisicaoFoto("DELETE", [URLQueryItem(name: "id", value: id)]))
    }

    private static func requisicaoFoto(_ metodo: String, _ itens: [URLQueryItem]) throws -> URLRequest {
        var req = try requisicao("api/fotos-treino", metodo: metodo)
        req.url = req.url?.appending(queryItems: itens)
        return req
    }
}

// MARK: - Redução

enum RedutorFoto {
    struct Reduzida: Sendable { let jpeg: Data; let tiradaEm: Date? }

    /// Reduz para no máximo 1.600 px e regrava sem EXIF (a localização não vai junto). Lê só o necessário, sem abrir a foto inteira na memória.
    nonisolated static func reduzir(_ dados: Data) -> Reduzida? {
        guard let fonte = CGImageSourceCreateWithData(dados as CFData, [kCGImageSourceShouldCache: false] as CFDictionary) else { return nil }
        let opcoes: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: 1600,
        ]
        guard let img = CGImageSourceCreateThumbnailAtIndex(fonte, 0, opcoes as CFDictionary) else { return nil }
        let saida = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(saida, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(dest, img, [kCGImageDestinationLossyCompressionQuality: 0.78] as CFDictionary)
        guard CGImageDestinationFinalize(dest) else { return nil }

        var quando: Date?
        if let props = CGImageSourceCopyPropertiesAtIndex(fonte, 0, nil) as? [CFString: Any],
           let exif = props[kCGImagePropertyExifDictionary] as? [CFString: Any],
           let texto = exif[kCGImagePropertyExifDateTimeOriginal] as? String {
            let f = DateFormatter()
            f.locale = Locale(identifier: "en_US_POSIX")
            f.calendar = Calendar(identifier: .gregorian)
            if let fuso = exif[kCGImagePropertyExifOffsetTimeOriginal] as? String {
                f.dateFormat = "yyyy:MM:dd HH:mm:ssxxxxx"
                quando = f.date(from: texto + fuso)
            }
            if quando == nil {
                f.dateFormat = "yyyy:MM:dd HH:mm:ss"
                quando = f.date(from: texto)
            }
        }
        return Reduzida(jpeg: saida as Data, tiradaEm: quando)
    }
}

// MARK: - Store

@Observable
@MainActor
final class FotosStore {
    static let comum = FotosStore()

    private(set) var porChave: [String: [FotoTreino]] = [:]
    /// chave → (feitas, total) do envio em andamento
    private(set) var enviando: [String: (feitas: Int, total: Int)] = [:]

    @ObservationIgnored private let memoria: NSCache<NSString, UIImage> = {
        let c = NSCache<NSString, UIImage>()
        c.totalCostLimit = 40_000_000
        return c
    }()
    @ObservationIgnored private let pasta: URL = {
        let u = URL.cachesDirectory.appending(path: "fotos", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: u, withIntermediateDirectories: true)
        return u
    }()

    func carregar() async {
        guard Servidor.configurado, let lista = try? await Servidor.listarFotosTreino() else { return }
        porChave = Dictionary(grouping: lista.sorted { $0.ordem < $1.ordem }, by: \.chave)
    }

    func fotos(_ chave: String) -> [FotoTreino] { porChave[chave] ?? [] }

    /// Envia uma a uma; devolve o aviso de erro, se houver.
    func enviar(_ itens: [PhotosPickerItem], chave: String) async -> String? {
        guard enviando[chave] == nil else { return nil }
        enviando[chave] = (0, itens.count)
        defer { enviando[chave] = nil }
        var falhas = 0
        var motivo: String?
        for (i, item) in itens.enumerated() {
            do {
                guard let dados = try await item.loadTransferable(type: Data.self) else { throw Servidor.Erro.rede("foto indisponível") }
                guard let r = await Task.detached(operation: { RedutorFoto.reduzir(dados) }).value else { throw Servidor.Erro.rede("formato não reconhecido") }
                let f = try await Servidor.enviarFotoTreino(chave: chave, jpeg: r.jpeg, tiradaEm: r.tiradaEm)
                gravar(r.jpeg, nome: f.id)
                porChave[chave] = (fotos(chave) + [f]).sorted { $0.ordem < $1.ordem }
            } catch {
                falhas += 1
                motivo = error.localizedDescription
            }
            enviando[chave] = (i + 1, itens.count)
        }
        return falhas > 0 ? "\(falhas) de \(itens.count) não foram enviadas. \(motivo ?? "")" : nil
    }

    func apagar(_ f: FotoTreino) async -> String? {
        do {
            try await Servidor.apagarFotoTreino(id: f.id)
            porChave[f.chave] = fotos(f.chave).filter { $0.id != f.id }
            for nome in [f.id, f.id + "-mini"] {
                memoria.removeObject(forKey: nome as NSString)
                try? FileManager.default.removeItem(at: pasta.appending(path: nome + ".jpg"))
            }
            return nil
        } catch {
            return error.localizedDescription
        }
    }

    func imagem(_ f: FotoTreino, miniatura: Bool) async -> UIImage? {
        let nome = miniatura ? f.id + "-mini" : f.id
        if let i = memoria.object(forKey: nome as NSString) { return i }
        let arquivo = pasta.appending(path: nome + ".jpg")
        var dados = try? Data(contentsOf: arquivo)
        if dados == nil {
            dados = try? await Servidor.baixarFotoTreino(id: f.id, miniatura: miniatura)
            if let dados { gravar(dados, nome: nome) }
        }
        guard let dados, let img = await UIImage(data: dados)?.byPreparingForDisplay() else { return nil }
        memoria.setObject(img, forKey: nome as NSString, cost: Int(img.size.width * img.size.height * 4))
        return img
    }

    private func gravar(_ d: Data, nome: String) { try? d.write(to: pasta.appending(path: nome + ".jpg")) }
}

// MARK: - Vistas

/// Foto carregada sob demanda (só quando aparece na tela).
struct FotoTreinoView: View {
    let foto: FotoTreino
    var miniatura = true
    var preencher = true
    @State private var imagem: UIImage?
    @State private var falhou = false

    var body: some View {
        ZStack {
            if let imagem {
                if preencher {
                    Color.clear.overlay { Image(uiImage: imagem).resizable().scaledToFill() }.clipped()
                } else {
                    Image(uiImage: imagem).resizable().scaledToFit()
                }
            } else if falhou {
                Image(systemName: "photo.badge.exclamationmark").foregroundStyle(Tema.textoSuave)
            } else {
                Tema.texto.opacity(0.06)
            }
        }
        .task(id: foto.id) {
            imagem = await FotosStore.comum.imagem(foto, miniatura: miniatura)
            falhou = imagem == nil && !Task.isCancelled
        }
    }
}

/// Bloco "Fotos" do treino ou da prova: adicionar, ver e excluir.
struct BlocoFotos: View {
    let chave: String
    private let store = FotosStore.comum
    @State private var escolhidas: [PhotosPickerItem] = []
    @State private var aberta: FotoTreino?
    @State private var aviso: String?

    init(chave: String) { self.chave = chave }

    var body: some View {
        let fotos = store.fotos(chave)
        let envio = store.enviando[chave]
        Secao(titulo: fotos.isEmpty ? "Fotos" : "Fotos (\(fotos.count))", icone: "camera.fill", tom: Tema.azul) {
            if !fotos.isEmpty {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 92), spacing: 6)], spacing: 6) {
                    ForEach(fotos) { f in
                        Button { aberta = f } label: {
                            FotoTreinoView(foto: f).aspectRatio(1, contentMode: .fit).clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Abrir foto")
                    }
                }
            }
            if let envio {
                ProgressView(value: Double(envio.feitas), total: Double(max(envio.total, 1))) {
                    Text("Enviando \(min(envio.feitas + 1, envio.total)) de \(envio.total)…").font(.footnote).foregroundStyle(Tema.textoSuave)
                }
                .tint(Tema.azul)
            } else {
                PhotosPicker(selection: $escolhidas, maxSelectionCount: 10, matching: .images, preferredItemEncoding: .compatible) {
                    Label("Adicionar fotos", systemImage: "plus")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Tema.azul)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Tema.azul.opacity(0.10), in: RoundedRectangle(cornerRadius: 14))
                }
            }
            if let aviso { Text(aviso).font(.footnote).foregroundStyle(Tema.vermelho) }
        }
        .onChange(of: escolhidas) { _, novas in
            guard !novas.isEmpty else { return }
            escolhidas = []
            aviso = nil
            Task { aviso = await store.enviar(novas, chave: chave) }
        }
        .fullScreenCover(item: $aberta) { FotosCheias(chave: chave, inicial: $0.id) }
    }
}

private struct FotosCheias: View {
    let chave: String
    @State private var atual: String
    @State private var confirmar = false
    @State private var apagando = false
    @State private var aviso: String?
    @Environment(\.dismiss) private var dismiss
    private let store = FotosStore.comum

    init(chave: String, inicial: String) {
        self.chave = chave
        _atual = State(initialValue: inicial)
    }

    var body: some View {
        let fotos = store.fotos(chave)
        TabView(selection: $atual) {
            ForEach(fotos) { f in
                FotoTreinoView(foto: f, miniatura: false, preencher: false).tag(f.id)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: fotos.count > 1 ? .automatic : .never))
        .background(.black)
        .overlay(alignment: .top) {
            HStack {
                botao("xmark", "Fechar") { dismiss() }
                Spacer()
                if apagando { ProgressView().tint(.white) } else { botao("trash", "Excluir foto") { confirmar = true } }
            }
            .padding(16)
        }
        .overlay(alignment: .bottom) {
            if let aviso { Text(aviso).font(.footnote).foregroundStyle(.white).padding(10).background(Tema.vermelho, in: Capsule()).padding(.bottom, 60) }
        }
        .confirmationDialog("Excluir esta foto do treino? A original continua na sua Fototeca.", isPresented: $confirmar, titleVisibility: .visible) {
            Button("Excluir", role: .destructive) { Task { await excluir() } }
            Button("Cancelar", role: .cancel) {}
        }
    }

    private func excluir() async {
        let fotos = store.fotos(chave)
        guard let i = fotos.firstIndex(where: { $0.id == atual }) else { return }
        let proxima = i + 1 < fotos.count ? fotos[i + 1].id : (i > 0 ? fotos[i - 1].id : nil)
        apagando = true
        aviso = await store.apagar(fotos[i])
        apagando = false
        guard aviso == nil else { return }
        if let proxima { atual = proxima } else { dismiss() }
    }

    private func botao(_ icone: String, _ rotulo: String, _ acao: @escaping () -> Void) -> some View {
        Button(action: acao) {
            Image(systemName: icone).font(.headline).foregroundStyle(.white).frame(width: 46, height: 46).background(.white.opacity(0.2), in: Circle())
        }
        .accessibilityLabel(rotulo)
    }
}
