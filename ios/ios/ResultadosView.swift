import Charts
import MapKit
import SwiftUI

private let ptBR = Locale(identifier: "pt_BR")

// MARK: - Lista

enum FiltroTreino: String, CaseIterable, Identifiable {
    case todos = "Todos"
    case provas = "Provas"
    case corrida = "Corrida"
    case caminhada = "Caminhada"
    case forca = "Força"
    case outro = "Outros"
    var id: String { rawValue }
    var rotulo: String { rawValue }
    var cor: Color {
        switch self {
        case .todos: Tema.texto
        case .provas: Tema.ouro
        case .corrida: corDoTreino(tipo: "corrida", icone: nil)
        case .caminhada: corDoTreino(tipo: "caminhada", icone: nil)
        case .forca: corDoTreino(tipo: "forca", icone: nil)
        case .outro: corDoTreino(tipo: "outro", icone: nil)
        }
    }
    var chave: String? {
        switch self {
        case .todos, .provas: nil
        case .corrida: "corrida"
        case .caminhada: "caminhada"
        case .forca: "forca"
        case .outro: "outro"
        }
    }
}

enum PeriodoResultados: String, CaseIterable, Identifiable {
    case semana = "Semana"
    case mes = "Mês"
    case ano = "Ano"
    var id: String { rawValue }
}

/// Totais do que está na tela (já com os filtros aplicados).
struct TotaisResultados {
    var treinos = 0
    var distanciaKm = 0.0
    var tempoSeg = 0.0
    var subidaM = 0.0
    var caloriasKcal = 0.0
    /// treinos que entraram na soma de distância (corridas, ou o tipo escolhido no filtro)
    var comDistancia = 0

    var paceSegKm: Double? { distanciaKm > 0.2 ? tempoDistanciaSeg / distanciaKm : nil }
    var tempoDistanciaSeg = 0.0
}

@Observable
@MainActor
final class ResultadosStore {
    var treinos: [ResumoCorrida] = []
    var periodo: PeriodoResultados = .mes
    var ano = Calendar.current.component(.year, from: Date())
    /// primeiro dia do mês mostrado
    var mesRef: Date = ResultadosStore.inicioDoMes(Date())
    /// segunda-feira da semana mostrada
    var semanaRef: Date = ResultadosStore.inicioDaSemana(Date())
    var filtro: FiltroTreino = .todos
    var categoria: CategoriaCorrida = .todas
    var carregando = false
    var erro: String?
    /// tipo de sessão da análise por IA, quando a corrida já está no site
    var tiposDoSite: [String: String] = [:]

    static var calendario: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.firstWeekday = 2
        c.locale = Locale(identifier: "pt_BR")
        c.timeZone = .current
        return c
    }

    static func inicioDoMes(_ d: Date) -> Date { calendario.dateInterval(of: .month, for: d)!.start }
    static func inicioDaSemana(_ d: Date) -> Date { calendario.dateInterval(of: .weekOfYear, for: d)!.start }

    /// intervalo de datas do período escolhido
    var intervalo: (de: Date, ate: Date) {
        let c = Self.calendario
        switch periodo {
        case .semana: return (semanaRef, c.date(byAdding: .day, value: 7, to: semanaRef)!)
        case .mes: return (mesRef, c.date(byAdding: .month, value: 1, to: mesRef)!)
        case .ano:
            let de = c.date(from: DateComponents(year: ano, month: 1, day: 1))!
            return (de, c.date(from: DateComponents(year: ano + 1, month: 1, day: 1))!)
        }
    }

    /// muda a chave quando algo que exige nova leitura do Saúde muda
    var chave: String { "\(periodo.rawValue)-\(intervalo.de.timeIntervalSince1970)" }

    var tituloDoPeriodo: String {
        let loc = Locale(identifier: "pt_BR")
        switch periodo {
        case .semana:
            let fim = Self.calendario.date(byAdding: .day, value: 6, to: semanaRef)!
            let a = semanaRef.formatted(.dateTime.day().locale(loc))
            let b = fim.formatted(.dateTime.day().month(.abbreviated).locale(loc)).replacingOccurrences(of: ".", with: "")
            return "\(a) a \(b)"
        case .mes: return mesRef.formatted(.dateTime.month(.wide).year().locale(loc)).capitalized
        case .ano: return String(ano)
        }
    }

    func mover(_ passo: Int) {
        let c = Self.calendario
        switch periodo {
        case .semana: semanaRef = c.date(byAdding: .day, value: 7 * passo, to: semanaRef)!
        case .mes: mesRef = c.date(byAdding: .month, value: passo, to: mesRef)!
        case .ano: ano += passo
        }
    }

    /// só avança até o período atual
    var podeAvancar: Bool { intervalo.ate <= Date() }

    /// nome e "foi prova" escolhidos no app (chave = id do treino)
    var marcas: [String: MarcaTreino] = [:]

    var visiveis: [ResumoCorrida] {
        treinos.filter { t in
            if filtro == .provas { return marcas[t.id]?.prova == true }
            if let chave = filtro.chave, (t.tipo ?? "corrida") != chave { return false }
            if filtro == .corrida, categoria != .todas, t.categoria != categoria { return false }
            return true
        }
    }

    /// quantas corridas há em cada faixa de distância (para mostrar nos botões)
    func contagem(_ cat: CategoriaCorrida) -> Int {
        let corridas = treinos.filter { ($0.tipo ?? "corrida") == "corrida" }
        return cat == .todas ? corridas.count : corridas.filter { $0.categoria == cat }.count
    }

    var totais: TotaisResultados {
        var t = TotaisResultados()
        // distância e pace contam as corridas (com o filtro "Todos") ou o tipo escolhido
        let tipoDistancia = filtro.chave ?? "corrida"
        for x in visiveis {
            t.treinos += 1
            t.tempoSeg += x.tempoSeg
            t.caloriasKcal += x.caloriasKcal ?? 0
            if (x.tipo ?? "corrida") == tipoDistancia, x.distanciaM > 0 {
                t.distanciaKm += x.distanciaM / 1000
                t.tempoDistanciaSeg += x.tempoSeg
                t.subidaM += x.elevacaoM ?? 0
                t.comDistancia += 1
            }
        }
        return t
    }

    /// Treinos agrupados por mês, mais recente primeiro.
    var porMes: [(titulo: String, itens: [ResumoCorrida])] {
        var grupos: [(titulo: String, itens: [ResumoCorrida])] = []
        for t in visiveis {
            let titulo = t.data.formatted(.dateTime.month(.wide).year().locale(Locale(identifier: "pt_BR"))).capitalized
            if let i = grupos.firstIndex(where: { $0.titulo == titulo }) { grupos[i].itens.append(t) } else { grupos.append((titulo, [t])) }
        }
        return grupos
    }

    func carregar(saude: SaudeSync) async {
        carregando = true
        defer { carregando = false }
        if saude.anosDisponiveis.isEmpty { await saude.carregarAnos() }
        do {
            let i = intervalo
            treinos = try await saude.listarTreinos(de: i.de, ate: i.ate)
            erro = nil
        } catch {
            erro = error.localizedDescription
        }
        if let lista = try? await Servidor.listarMarcas() {
            marcas = Dictionary(lista.map { ($0.chave, $0) }, uniquingKeysWith: { a, _ in a })
        }
        // opcional: marca as que a IA já analisou (ignora falha de rede)
        if tiposDoSite.isEmpty, let doSite = try? await Servidor.listarCorridas(limite: 60) {
            tiposDoSite = Dictionary(uniqueKeysWithValues: doSite.compactMap { c in c.tipoSessao.map { (c.id.uppercased(), $0) } })
        }
    }
}

struct ResultadosView: View {
    @State private var store = ResultadosStore()
    @Environment(\.scenePhase) private var fase
    var saude: SaudeSync
    var ajustes: () -> Void

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 10, pinnedViews: []) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Resultados").font(.system(size: 40, weight: .heavy)).foregroundStyle(Tema.texto)
                    }
                    Spacer()
                    Button(action: ajustes) {
                        Image(systemName: "gearshape")
                            .font(.title3)
                            .foregroundStyle(Tema.texto)
                            .frame(width: 46, height: 46)
                            .background(Tema.cartao, in: Circle())
                            .overlay(Circle().stroke(Tema.linha, lineWidth: 1))
                    }
                    .accessibilityLabel("Ajustes")
                }
                .padding(.top, 8)

                seletorDePeriodo
                totalizadores
                filtros

                if let erro = store.erro {
                    Label(erro, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .foregroundStyle(Color.orange)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
                }

                if store.carregando && store.treinos.isEmpty { ProgressView().frame(maxWidth: .infinity).padding(.top, 30) }

                ForEach(store.porMes, id: \.titulo) { grupo in
                    if store.periodo == .ano { Text(grupo.titulo).font(.title3.bold()).foregroundStyle(Tema.texto).padding(.top, 8) }
                    ForEach(grupo.itens) { t in
                        NavigationLink(value: t) {
                            LinhaTreino(treino: t, saude: saude, tipoSessao: store.tiposDoSite[t.id.uppercased()], marca: store.marcas[t.id])
                        }
                        .buttonStyle(.plain)
                    }
                }

                if store.visiveis.isEmpty && !store.carregando && store.erro == nil {
                    Text("Nenhum treino neste período e filtro.")
                        .font(.footnote).foregroundStyle(Tema.textoSuave)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
        }
        .background(FundoColorido())
        .refreshable { await store.carregar(saude: saude) }
        .toolbar(.hidden, for: .navigationBar)
        .navigationDestination(for: ResumoCorrida.self) { t in
            ResultadoCorridaView(resumo: t, saude: saude, marcaInicial: store.marcas[t.id]) { nova in
                store.marcas[t.id] = nova
            }
        }
        .task(id: store.chave) { await store.carregar(saude: saude) }
        // ao voltar para o app (ex.: depois de um treino), lê o Saúde de novo
        .onChange(of: fase) { _, nova in
            if nova == .active { Task { await store.carregar(saude: saude) } }
        }
    }

    // MARK: período

    private var seletorDePeriodo: some View {
        VStack(spacing: 10) {
            Picker("Período", selection: $store.periodo) {
                ForEach(PeriodoResultados.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)

            HStack {
                Button { store.mover(-1) } label: {
                    Image(systemName: "chevron.left").frame(width: 40, height: 36)
                }
                .accessibilityLabel("Período anterior")
                Spacer()
                if store.periodo == .ano && saude.anosDisponiveis.count > 1 {
                    Picker("Ano", selection: $store.ano) {
                        ForEach(saude.anosDisponiveis, id: \.self) { Text(String($0)).tag($0) }
                    }
                    .pickerStyle(.menu)
                    .tint(Tema.texto)
                } else {
                    Text(store.tituloDoPeriodo).font(.headline).foregroundStyle(Tema.texto)
                }
                Spacer()
                Button { store.mover(1) } label: {
                    Image(systemName: "chevron.right").frame(width: 40, height: 36)
                }
                .disabled(!store.podeAvancar)
                .accessibilityLabel("Próximo período")
            }
            .foregroundStyle(Tema.texto)
            .padding(.horizontal, 6)
            .padding(.vertical, 4)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Tema.linha, lineWidth: 1))
        }
    }

    // MARK: totalizadores

    private var totalizadores: some View {
        let t = store.totais
        let tipoRotulo = store.filtro == .todos ? "corridas" : store.filtro.rotulo.lowercased()
        let verde = Color(red: 0.30, green: 0.68, blue: 0.38)
        // um painel escuro só para os totais: nada na lista abaixo se parece com ele
        return VStack(alignment: .leading, spacing: 14) {
            Text("TOTAIS DO PERÍODO").font(.caption.weight(.heavy)).tracking(0.8).foregroundStyle(Color.white.opacity(0.6))
            LazyVGrid(columns: [GridItem(.flexible(), alignment: .leading), GridItem(.flexible(), alignment: .leading)], spacing: 16) {
                TotalColorido(titulo: "Treinos", valor: "\(t.treinos)", icone: "figure.mixed.cardio", cor: Tema.azul)
                TotalColorido(titulo: "Tempo", valor: formatarDuracaoLonga(t.tempoSeg), icone: "clock.fill", cor: Tema.roxo)
                if t.comDistancia > 0 {
                    TotalColorido(titulo: "Distância (\(tipoRotulo))", valor: String(format: "%.1f km", t.distanciaKm).replacingOccurrences(of: ".", with: ","), icone: "map.fill", cor: Tema.laranja)
                    TotalColorido(titulo: "Pace médio", valor: "\(formatarPace(t.paceSegKm)) /km", icone: "speedometer", cor: Tema.aqua)
                    if t.subidaM > 0 { TotalColorido(titulo: "Subida", valor: "\(Int(t.subidaM.rounded())) m", icone: "mountain.2.fill", cor: verde) }
                    if store.filtro == .todos { TotalColorido(titulo: "Corridas", valor: "\(t.comDistancia)", icone: "figure.run", cor: Tema.vermelho) }
                } else if t.caloriasKcal > 0 {
                    TotalColorido(titulo: "Calorias ativas", valor: "\(Int(t.caloriasKcal.rounded())) kcal", icone: "flame.fill", cor: Tema.vermelho)
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(colors: [Color(red: 0.09, green: 0.10, blue: 0.14), Color(red: 0.14, green: 0.15, blue: 0.23)], startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 24)
        )
    }

    // MARK: filtros

    private var filtros: some View {
        VStack(alignment: .leading, spacing: 8) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(FiltroTreino.allCases) { f in
                        ficha(f.rotulo, ativo: store.filtro == f, cor: f.cor) {
                            store.filtro = f
                            if f != .corrida { store.categoria = .todas }
                        }
                    }
                }
            }
            // faixas de distância (meia, maratona...) só aparecem quando o filtro é "Corrida"
            if store.filtro == .corrida {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(CategoriaCorrida.allCases) { c in
                            ficha("\(c.rawValue) \(store.contagem(c))", ativo: store.categoria == c, cor: Tema.laranja) { store.categoria = c }
                        }
                    }
                }
            }
        }
    }

    private func ficha(_ texto: String, ativo: Bool, cor: Color = Tema.texto, acao: @escaping () -> Void) -> some View {
        Button(action: acao) {
            Text(texto)
                .font(.subheadline.weight(.medium))
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .foregroundStyle(ativo ? Color.white : Tema.texto)
                .background {
                    ZStack {
                        Capsule().fill(ativo ? cor : Color.white)
                        if !ativo { Capsule().fill(cor.opacity(0.13)) }
                    }
                }
                .overlay(Capsule().stroke(ativo ? cor : cor.opacity(0.35), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

/// Miniatura do traçado, desenhada em linha fina (como no histórico do Fitness).
private struct MiniRota: View {
    let pontos: [CLLocationCoordinate2D]
    var cor: Color = Tema.textoSuave

    var body: some View {
        GeometryReader { g in
            Path { path in
                guard pontos.count >= 2 else { return }
                let lats = pontos.map(\.latitude), lngs = pontos.map(\.longitude)
                guard let minLat = lats.min(), let maxLat = lats.max(), let minLng = lngs.min(), let maxLng = lngs.max() else { return }
                // longitude encolhe com a latitude: corrige para o desenho não ficar achatado
                let k = cos(((minLat + maxLat) / 2) * .pi / 180)
                let larg = max((maxLng - minLng) * k, 1e-6), alt = max(maxLat - minLat, 1e-6)
                let escala = min(g.size.width / larg, g.size.height / alt) * 0.92
                let ox = (g.size.width - larg * escala) / 2, oy = (g.size.height - alt * escala) / 2
                for (i, p) in pontos.enumerated() {
                    let x = ox + (p.longitude - minLng) * k * escala
                    let y = oy + (maxLat - p.latitude) * escala
                    if i == 0 { path.move(to: CGPoint(x: x, y: y)) } else { path.addLine(to: CGPoint(x: x, y: y)) }
                }
            }
            .stroke(cor, style: StrokeStyle(lineWidth: 1.8, lineCap: .round, lineJoin: .round))
        }
    }
}

/// Cor de cada exercício: o tipo geral (corrida, caminhada, força) e, nos "outros", o símbolo da atividade.
func corDoTreino(tipo: String?, icone: String?) -> Color {
    switch tipo ?? "corrida" {
    case "corrida": return Tema.laranja
    case "caminhada": return Tema.aqua
    case "forca": return Color(red: 0.36, green: 0.38, blue: 0.80)
    default:
        switch icone ?? "" {
        case "figure.pilates": return Color(red: 0.90, green: 0.42, blue: 0.62)
        case "figure.yoga": return Tema.roxo
        case "figure.outdoor.cycle": return Tema.azul
        case "figure.pool.swim": return Color(red: 0.20, green: 0.68, blue: 0.85)
        case "figure.highintensity.intervaltraining": return Tema.vermelho
        default: return Tema.cinzaPausa
        }
    }
}

struct LinhaTreino: View {
    let treino: ResumoCorrida
    var saude: SaudeSync
    var tipoSessao: String?
    var marca: MarcaTreino?
    @State private var rota: [CLLocationCoordinate2D] = []
    @State private var chaveFotos: String?

    private var ehProva: Bool { marca?.prova == true }
    /// prova é dourada e tem bandeira; o resto segue a cor do exercício
    private var corIcone: Color { ehProva ? Tema.ouro : corDoTreino(tipo: treino.tipo, icone: treino.icone) }
    private var simbolo: String { ehProva ? "flag.checkered" : (treino.icone ?? "figure.run") }
    /// prova: card escuro com detalhes dourados; os outros treinos seguem claros
    private var textoPrincipal: Color { ehProva ? .white : Tema.texto }
    private var textoSecundario: Color { ehProva ? Color.white.opacity(0.72) : Tema.textoSuave }

    private var titulo: String {
        if let nome = marca?.nome, !nome.isEmpty { return nome }
        if treino.distanciaM >= 50 { return String(format: "%.2f km ", treino.distanciaM / 1000).replacingOccurrences(of: ".", with: ",") + treino.nome }
        return treino.nome
    }

    /// "Ter, 24 nov" (curto, para não quebrar linha)
    private var dataCurta: String {
        let t = treino.data.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated).locale(ptBR)).replacingOccurrences(of: ".", with: "")
        return t.prefix(1).uppercased() + t.dropFirst()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                Image(systemName: simbolo)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(corIcone)
                    .frame(width: 46, height: 46)
                    .background(corIcone.opacity(ehProva ? 0.22 : 0.16), in: RoundedRectangle(cornerRadius: 13))
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(titulo).font(.headline).foregroundStyle(textoPrincipal).lineLimit(2).multilineTextAlignment(.leading)
                        if let marca, marca.prova { SeloProva(texto: marca.rotulo(distanciaMedidaM: treino.distanciaM)) }
                    }
                    Text(dataCurta).font(.subheadline).foregroundStyle(textoSecundario).lineLimit(1)
                }
                Spacer(minLength: 6)
                if let f = FotosStore.comum.fotos(chaveFotos ?? treino.id).first {
                    FotoTreinoView(foto: f).frame(width: 56, height: 46).clipShape(RoundedRectangle(cornerRadius: 10))
                } else if !rota.isEmpty { MiniRota(pontos: rota, cor: ehProva ? Tema.ouro : Tema.textoSuave).frame(width: 56, height: 44) }
                Image(systemName: "chevron.right").font(.caption).foregroundStyle(ehProva ? Color.white.opacity(0.5) : Color.gray.opacity(0.5))
            }
            // fichas numa linha própria, com largura inteira: não quebram dentro de si
            HStack(spacing: 6) {
                chip(formatarDuracao(treino.tempoSeg))
                if treino.temPace, let p = treino.paceSegKm { chip("\(formatarPace(p)) /km") }
                if let f = treino.fcMedia { chip("\(Int(f.rounded())) bpm") }
            }
            .padding(.leading, 58)
            if let t = tipoSessao ?? treino.tipoSessao {
                Text(t).font(.caption).foregroundStyle(Tema.laranja).lineLimit(1).padding(.leading, 58)
            }
        }
        .padding(.vertical, 14)
        .padding(.leading, 22)
        .padding(.trailing, 14)
        // cada exercício tem a sua cor: faixa na lateral, tom leve no fundo e borda da mesma cor
        .background {
            if ehProva {
                RoundedRectangle(cornerRadius: 18).fill(
                    LinearGradient(colors: [Color(red: 0.10, green: 0.11, blue: 0.15), Color(red: 0.20, green: 0.16, blue: 0.08)],
                                   startPoint: .topLeading, endPoint: .bottomTrailing)
                )
            } else {
                // lista limpa: cartão branco; a cor do exercício fica na faixa lateral e no ícone
                RoundedRectangle(cornerRadius: 18).fill(Tema.cartao)
            }
        }
        .overlay(alignment: .leading) {
            Capsule().fill(corIcone).frame(width: 5).padding(.vertical, 12).padding(.leading, 8)
        }
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(ehProva ? Tema.ouro.opacity(0.75) : Tema.linha, lineWidth: ehProva ? 1.5 : 1))
        .task { if treino.tipo == "corrida" || treino.tipo == "caminhada" { rota = await saude.miniatura(id: treino.id) } }
        .task { if treino.distanciaM > 40_000 { chaveFotos = await MaratonasStore.chaveFotos(de: treino) } }
    }

    private func chip(_ texto: String) -> some View {
        Text(texto)
            .font(.caption.weight(.medium))
            .monospacedDigit()
            .foregroundStyle(textoPrincipal)
            .lineLimit(1)
            .fixedSize()
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(ehProva ? Color.white.opacity(0.14) : Color(red: 0.945, green: 0.947, blue: 0.960), in: RoundedRectangle(cornerRadius: 7))
    }
}

/// Total do período: ícone colorido e número em branco, dentro do painel escuro do topo.
struct TotalColorido: View {
    let titulo: String
    let valor: String
    let icone: String
    let cor: Color

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icone)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(.white)
                .frame(width: 36, height: 36)
                .background(cor, in: Circle())
            VStack(alignment: .leading, spacing: 1) {
                Text(titulo).font(.caption.weight(.medium)).foregroundStyle(Color.white.opacity(0.65)).lineLimit(1).minimumScaleFactor(0.8)
                Text(valor).font(.title3.weight(.heavy)).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.7)
            }
            Spacer(minLength: 0)
        }
    }
}

/// Selo dourado das provas: "21K", "42K"...
struct SeloProva: View {
    let texto: String
    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: "flag.checkered").font(.system(size: 9, weight: .bold))
            Text(texto).font(.caption.weight(.heavy))
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background(Tema.ouro, in: Capsule())
        .fixedSize()
    }
}

// MARK: - Editar nome e prova

struct EditarTreinoView: View {
    let resumo: ResumoCorrida
    let marcaAtual: MarcaTreino?
    var aoSalvar: (MarcaTreino?) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var nome: String
    @State private var prova: Bool
    @State private var oficial: Double
    @State private var salvando = false
    @State private var erro: String?

    private static let distancias: [(rotulo: String, metros: Double)] = [
        ("Medida pelo relógio", 0), ("5 km", 5000), ("10 km", 10000), ("15 km", 15000),
        ("Meia maratona (21,0975 km)", 21097.5), ("30 km", 30000), ("Maratona (42,195 km)", 42195),
    ]

    init(resumo: ResumoCorrida, marcaAtual: MarcaTreino?, aoSalvar: @escaping (MarcaTreino?) -> Void) {
        self.resumo = resumo
        self.marcaAtual = marcaAtual
        self.aoSalvar = aoSalvar
        _nome = State(initialValue: marcaAtual?.nome ?? "")
        _prova = State(initialValue: marcaAtual?.prova ?? false)
        // sem distância escolhida, sugere a distância padrão mais próxima da medida (até 3%)
        let sugerida = Self.distancias.dropFirst().first { abs(resumo.distanciaM - $0.metros) / $0.metros <= 0.03 }?.metros ?? 0
        _oficial = State(initialValue: marcaAtual?.distanciaOficialM ?? sugerida)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(resumo.nome, text: $nome)
                } header: {
                    Text("Nome")
                } footer: {
                    Text("Vazio = nome padrão do treino.")
                }
                Section {
                    Toggle("Foi prova", isOn: $prova)
                    if prova {
                        Picker("Distância oficial", selection: $oficial) {
                            ForEach(Self.distancias, id: \.metros) { Text($0.rotulo).tag($0.metros) }
                        }
                    }
                } footer: {
                    Text(prova
                         ? "Provas ganham o selo dourado na lista e entram no cálculo do VPONTO (pelo tempo e pela distância oficial)."
                         : "O relógio não sabe se foi prova: marque aqui.")
                }
                if let erro {
                    Section { Label(erro, systemImage: "exclamationmark.triangle.fill").foregroundStyle(.orange).font(.footnote) }
                }
            }
            .navigationTitle("Editar treino")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(salvando ? "Salvando…" : "Salvar") { Task { await salvar() } }.disabled(salvando)
                }
            }
        }
        .preferredColorScheme(.light)
    }

    private func salvar() async {
        salvando = true
        erro = nil
        defer { salvando = false }
        let nomeLimpo = nome.trimmingCharacters(in: .whitespacesAndNewlines)
        let marca = MarcaTreino(chave: resumo.id, nome: nomeLimpo.isEmpty ? nil : nomeLimpo, prova: prova, distanciaOficialM: prova && oficial > 0 ? oficial : nil)
        do {
            let salva = try await Servidor.salvarMarca(marca)
            aoSalvar(salva)
            dismiss()
        } catch {
            erro = error.localizedDescription
        }
    }
}

// MARK: - Detalhe

struct ResultadoCorridaView: View {
    let resumo: ResumoCorrida
    var saude: SaudeSync
    var marcaInicial: MarcaTreino? = nil
    var aoMudarMarca: (MarcaTreino?) -> Void = { _ in }
    @State private var marca: MarcaTreino?
    @State private var editando = false
    @State private var resultado: ResultadoCorrida?
    @State private var payload: TreinoSaudePayload?
    @State private var erro: String?
    @State private var analisando = false
    @State private var avisoIA: String?
    /// o id do treino ou, se for uma maratona que já está na aba Maratonas, a chave dela (as fotos são as mesmas)
    @State private var chaveFotos: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let r = resultado {
                    ConteudoResultado(r: r, nomeExibido: marca?.nome ?? (marca?.prova == true ? resumo.nome : nil), tituloReplay: resumo.nome, icone: resumo.icone ?? "figure.run", selo: marca?.prova == true ? marca?.rotulo(distanciaMedidaM: r.distanciaM) : nil, aoAnalisar: r.analise == nil && Servidor.configurado && resumo.ehCorrida ? { Task { await analisar() } } : nil, analisando: analisando, avisoIA: avisoIA, chaveFotos: chaveFotos)
                } else if let erro {
                    Label(erro, systemImage: "exclamationmark.triangle.fill").foregroundStyle(Color.orange).font(.footnote)
                } else {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 60)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
        }
        .background(Tema.fundo)
        .navigationTitle(resumo.data.formatted(.dateTime.weekday(.wide).day().month(.wide).locale(ptBR)).capitalized)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { editando = true } label: { Image(systemName: "pencil.circle") }
                    .accessibilityLabel("Editar nome e prova")
            }
        }
        .sheet(isPresented: $editando) {
            EditarTreinoView(resumo: resumo, marcaAtual: marca) { nova in
                marca = nova
                aoMudarMarca(nova)
            }
        }
        .task {
            marca = marcaInicial
            chaveFotos = await MaratonasStore.chaveFotos(de: resumo)
            await carregar()
        }
    }

    private func carregar() async {
        do {
            guard let p = try await saude.payloadDaCorrida(id: resumo.id) else {
                erro = "Não encontrei essa corrida no app Saúde."
                return
            }
            payload = p
            var r = ConstrutorResultado.montar(payload: p, fcMaxima: await saude.fcMaximaReferencia())
            r.nome = resumo.nome
            resultado = r
        } catch {
            erro = error.localizedDescription
            return
        }
        await mesclarComSite()
    }

    /// Se a corrida já está no site, traz de lá a análise por IA, o treino planejado e a comparação.
    private func mesclarComSite() async {
        guard Servidor.configurado, let local = resultado, let remoto = try? await Servidor.buscarResultado(id: resumo.id) else { return }
        var r = local
        r.analise = remoto.analise
        r.analisadaEm = remoto.analisadaEm
        // plano e comparação só valem para corridas: caminhada, força etc. do mesmo dia não são planejadas
        if resumo.ehCorrida {
            r.planejado = remoto.planejado
            r.comparacao = remoto.comparacao
        }
        // as etapas locais têm todas as métricas; do site só entram os nomes (que levam o plano em conta)
        if remoto.voltas.count == r.voltas.count { for i in r.voltas.indices { r.voltas[i].rotulo = remoto.voltas[i].rotulo } }
        else if r.voltas.isEmpty { r.voltas = remoto.voltas }
        resultado = r
    }

    /// Envia só esta corrida ao site, pede a análise e traz o resultado de volta.
    private func analisar() async {
        guard let p = payload else { return }
        analisando = true
        avisoIA = nil
        defer { analisando = false }
        do {
            _ = try await Servidor.enviarTreinosSaude([p])
            try await Servidor.analisarCorrida(id: resumo.id)
            await mesclarComSite()
        } catch {
            avisoIA = "Não foi possível analisar: \(error.localizedDescription)"
        }
    }
}

/// Abre o replay da corrida no mapa.
private struct BotaoReplay: View {
    let r: ResultadoCorrida
    let titulo: String
    let icone: String
    @State private var corrida: CorridaReplay?
    var body: some View {
        Button {
            corrida = CorridaReplay(r: r, titulo: titulo, icone: icone)
        } label: { Label("Reviver no mapa", systemImage: "play.fill") }
            .buttonStyle(BotaoPrincipal())
            .fullScreenCover(item: $corrida) { ReplayView($0) }
    }
}

private struct ConteudoResultado: View {
    let r: ResultadoCorrida
    /// nome e selo escolhidos pelo Marcio (nil = padrão)
    var nomeExibido: String? = nil
    /// nome e símbolo do treino usados no replay
    var tituloReplay: String? = nil
    var icone = "figure.run"
    var selo: String? = nil
    var aoAnalisar: (() -> Void)?
    var analisando = false
    var avisoIA: String?
    var chaveFotos: String? = nil

    var body: some View {
        cabecalho
        if r.polyline != nil {
            MapaRota(r: r)
            if r.distanciaM > 200, r.tempoSeg > 60 { BotaoReplay(r: r, titulo: nomeExibido ?? tituloReplay ?? r.nome, icone: icone) }
        }
        if let chaveFotos, Servidor.configurado { BlocoFotos(chave: chaveFotos) }
        if let c = r.comparacao, let p = r.planejado { BlocoComparacao(comparacao: c, planejado: p) }
        if r.serie.count > 10 { BlocoGraficos(serie: r.serie) }
        BlocoZonas(zonas: r.zonas)
        if r.splits.count >= 2 || r.voltas.count > 1 { BlocoSplits(splits: r.splits, voltas: r.voltas, serie: r.serie) }
        if r.voltas.count > 1 { BlocoVoltas(voltas: r.voltas) }
        BlocoMetricas(m: r.metricas)
        // a análise por IA fica por último: primeiro os números, depois a leitura deles
        if let a = r.analise {
            BlocoAnalise(analise: a)
        } else if aoAnalisar != nil || analisando {
            Secao(titulo: "Treinador IA", icone: "sparkles", tom: Tema.laranja) {
                Text("Envia esta corrida ao site e pede uma análise com a sua metodologia, usando as etapas, os splits e as métricas do relógio.")
                    .font(.subheadline).foregroundStyle(Tema.textoSuave)
                Button { aoAnalisar?() } label: {
                    HStack { if analisando { ProgressView() }; Text(analisando ? "Analisando…" : "Analisar com IA") }
                }
                .buttonStyle(BotaoPrincipal())
                .disabled(analisando)
                if let avisoIA { Text(avisoIA).font(.footnote).foregroundStyle(Tema.vermelho) }
            }
        }
    }

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 12) {
            if nomeExibido != nil || selo != nil {
                HStack(spacing: 8) {
                    Text(nomeExibido ?? r.nome).font(.title3.bold()).foregroundStyle(Tema.texto).lineLimit(2)
                    if let selo { SeloProva(texto: selo) }
                }
            }
            // treinos sem distância (força, pilates...) destacam o tempo
            Text(r.distanciaM >= 50
                 ? String(format: "%.2f", r.distanciaM / 1000).replacingOccurrences(of: ".", with: ",") + " km"
                 : formatarDuracao(r.tempoSeg))
                .font(.system(size: 44, weight: .heavy)).foregroundStyle(Tema.texto)
            HStack(spacing: 10) {
                if r.distanciaM >= 50 {
                    Metrica(titulo: "Tempo", valor: formatarDuracao(r.tempoSeg))
                    Metrica(titulo: "Pace", valor: "\(formatarPace(r.paceSegKm)) /km")
                }
                Metrica(titulo: "FC média", valor: r.metricas.fcMedia.map { "\(Int($0.rounded())) bpm" } ?? "—")
                if r.distanciaM < 50, let kcal = r.metricas.caloriasKcal { Metrica(titulo: "Calorias", valor: "\(Int(kcal.rounded())) kcal") }
            }
        }
    }
}

// MARK: - Mapa

enum EstiloMapaApp: String, CaseIterable {
    case padrao = "Mapa"
    case satelite = "Satélite"
}

/// Cor do pace: azul (rápido) → amarelo → vermelho (lento), vivas para se destacar no mapa.
func corDoPace(_ t: Double) -> Color {
    let azul = (0.0, 0.66, 1.0), amarelo = (1.0, 0.84, 0.04), vermelho = (1.0, 0.23, 0.19)
    let x = min(1, max(0, t))
    func mix(_ a: (Double, Double, Double), _ b: (Double, Double, Double), _ f: Double) -> Color {
        Color(red: a.0 + (b.0 - a.0) * f, green: a.1 + (b.1 - a.1) * f, blue: a.2 + (b.2 - a.2) * f)
    }
    return x <= 0.5 ? mix(azul, amarelo, x * 2) : mix(amarelo, vermelho, (x - 0.5) * 2)
}

struct TrechoColorido: Identifiable {
    let id: Int
    let coordenadas: [CLLocationCoordinate2D]
    let cor: Color
}

struct RotaColorida {
    let trechos: [TrechoColorido]
    /// faixa de pace usada na legenda (seg/km); nil quando a rota não tem velocidade por ponto
    let paceRapido: Double?
    let paceLento: Double?

    init(coordenadas coords: [CLLocationCoordinate2D], velocidades: [Double]?) {
        guard coords.count >= 2 else { trechos = []; paceRapido = nil; paceLento = nil; return }

        guard let vel = velocidades, vel.count == coords.count else {
            trechos = [TrechoColorido(id: 0, coordenadas: coords, cor: Tema.laranja)]
            paceRapido = nil
            paceLento = nil
            return
        }

        // velocidade média numa janela curta, para a cor não piscar a cada ponto
        let suave: [Double] = vel.indices.map { i in
            let faixa = vel[max(0, i - 5)...min(vel.count - 1, i + 5)].filter { $0 >= 1.4 }
            return faixa.isEmpty ? 0 : faixa.reduce(0, +) / Double(faixa.count)
        }
        let paces = suave.filter { $0 > 0 }.map { 1000 / $0 }.sorted()
        guard paces.count > 10 else {
            trechos = [TrechoColorido(id: 0, coordenadas: coords, cor: Tema.laranja)]
            paceRapido = nil
            paceLento = nil
            return
        }
        let rapido = paces[Int(Double(paces.count - 1) * 0.05)]
        let lento = paces[Int(Double(paces.count - 1) * 0.95)]
        paceRapido = rapido
        paceLento = lento

        // ~90 trechos; cada um termina onde o próximo começa para a linha não ter falhas
        let tamanho = max(3, coords.count / 90)
        var saida: [TrechoColorido] = []
        var inicio = 0
        var id = 0
        while inicio < coords.count - 1 {
            let fim = min(inicio + tamanho, coords.count - 1)
            let medias = suave[inicio...fim].filter { $0 > 0 }
            let cor: Color
            if medias.isEmpty {
                cor = Tema.cinzaPausa
            } else {
                let pace = 1000 / (medias.reduce(0, +) / Double(medias.count))
                cor = corDoPace(lento > rapido ? (pace - rapido) / (lento - rapido) : 0)
            }
            saida.append(TrechoColorido(id: id, coordenadas: Array(coords[inicio...fim]), cor: cor))
            id += 1
            inicio = fim
        }
        trechos = saida
    }
}

struct LegendaRitmo: View {
    let rapido: Double
    let lento: Double

    var body: some View {
        HStack(spacing: 8) {
            Text("\(formatarPace(rapido)) /km").font(.caption2.weight(.semibold)).monospacedDigit()
            LinearGradient(colors: [corDoPace(0), corDoPace(0.5), corDoPace(1)], startPoint: .leading, endPoint: .trailing)
                .frame(width: 90, height: 8)
                .clipShape(Capsule())
            Text("\(formatarPace(lento)) /km").font(.caption2.weight(.semibold)).monospacedDigit()
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(.ultraThinMaterial, in: Capsule())
    }
}

private struct MapaColorido: View {
    var interativo: Bool
    var estilo: EstiloMapaApp = .padrao
    // calculados uma vez ao criar a vista: decodificar a rota e montar os trechos a cada atualização travava o mapa
    private let coords: [CLLocationCoordinate2D]
    private let rota: RotaColorida
    private let regiaoInicial: MKCoordinateRegion

    init(r: ResultadoCorrida, interativo: Bool, estilo: EstiloMapaApp = .padrao) {
        self.interativo = interativo
        self.estilo = estilo
        let c = r.coordenadas.filter { CLLocationCoordinate2DIsValid($0) && ($0.latitude != 0 || $0.longitude != 0) }
        self.coords = c
        self.rota = RotaColorida(coordenadas: c, velocidades: r.velocidades)
        self.regiaoInicial = Self.regiao(c)
    }

    var body: some View {
        if coords.count < 2 {
            Text("Sem rota GPS nesta corrida.").font(.footnote).foregroundStyle(Tema.textoSuave)
                .frame(maxWidth: .infinity, maxHeight: .infinity).background(Tema.cartao)
        } else {
            Map(initialPosition: .region(regiaoInicial), interactionModes: interativo ? [.pan, .zoom, .rotate] : []) {
                // contorno branco por baixo, para a linha colorida se destacar
                MapPolyline(coordinates: coords).stroke(.white, lineWidth: 9)
                ForEach(rota.trechos) { t in
                    MapPolyline(coordinates: t.coordenadas).stroke(t.cor, lineWidth: 5.5)
                }
                if let ini = coords.first { Annotation("Largada", coordinate: ini) { Circle().fill(Tema.aqua).frame(width: 13, height: 13).overlay(Circle().stroke(.white, lineWidth: 2.5)) } }
                if let fim = coords.last { Annotation("Chegada", coordinate: fim) { Circle().fill(Tema.texto).frame(width: 13, height: 13).overlay(Circle().stroke(.white, lineWidth: 2.5)) } }
            }
            .mapStyle(estilo == .padrao ? .standard : .hybrid)
            .overlay(alignment: .bottomLeading) {
                if let rapido = rota.paceRapido, let lento = rota.paceLento {
                    LegendaRitmo(rapido: rapido, lento: lento).padding(10)
                }
            }
        }
    }

    private static func regiao(_ c: [CLLocationCoordinate2D]) -> MKCoordinateRegion {
        guard let primeiro = c.first else {
            return MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: -15.79, longitude: -47.88), span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05))
        }
        var minLat = primeiro.latitude, maxLat = primeiro.latitude, minLng = primeiro.longitude, maxLng = primeiro.longitude
        for p in c {
            minLat = min(minLat, p.latitude); maxLat = max(maxLat, p.latitude)
            minLng = min(minLng, p.longitude); maxLng = max(maxLng, p.longitude)
        }
        return MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2),
            span: MKCoordinateSpan(latitudeDelta: max((maxLat - minLat) * 1.35, 0.004), longitudeDelta: max((maxLng - minLng) * 1.35, 0.004))
        )
    }
}

private struct MapaRota: View {
    let r: ResultadoCorrida
    @State private var ampliado = false

    var body: some View {
        MapaColorido(r: r, interativo: false)
            .frame(height: 260)
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(Tema.linha, lineWidth: 1))
            .overlay(alignment: .topTrailing) {
                Image(systemName: "arrow.up.left.and.arrow.down.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Tema.texto)
                    .padding(9)
                    .background(.ultraThinMaterial, in: Circle())
                    .padding(10)
            }
            .contentShape(RoundedRectangle(cornerRadius: 20))
            .onTapGesture { ampliado = true }
            .accessibilityLabel("Mapa da corrida. Toque para ampliar.")
            .accessibilityAddTraits(.isButton)
            .fullScreenCover(isPresented: $ampliado) { MapaTelaCheia(r: r) }
    }
}

/// Mapa em tela cheia, com zoom e movimento livres e a troca entre mapa e satélite.
private struct MapaTelaCheia: View {
    let r: ResultadoCorrida
    @Environment(\.dismiss) private var dismiss
    @State private var estilo: EstiloMapaApp = .padrao

    var body: some View {
        ZStack(alignment: .top) {
            MapaColorido(r: r, interativo: true, estilo: estilo)
                .ignoresSafeArea()
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.headline)
                        .foregroundStyle(Tema.texto)
                        .frame(width: 46, height: 46)
                        .background(.regularMaterial, in: Circle())
                }
                .accessibilityLabel("Fechar mapa")
                Spacer()
                Picker("Estilo", selection: $estilo) {
                    ForEach(EstiloMapaApp.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .frame(width: 180)
                .padding(4)
                .background(.regularMaterial, in: Capsule())
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
        }
        .preferredColorScheme(.light)
    }
}

// MARK: - Seções

struct Secao<Conteudo: View>: View {
    let titulo: String
    var cor: Color = Tema.texto
    /// símbolo SF e cor de destaque (opcionais): dão um respingo de cor ao cartão
    var icone: String? = nil
    var tom: Color? = nil
    @ViewBuilder var conteudo: () -> Conteudo

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                if let icone, let tom {
                    Image(systemName: icone)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(tom)
                        .frame(width: 30, height: 30)
                        .background(tom.opacity(0.16), in: RoundedRectangle(cornerRadius: 9))
                }
                Text(titulo).font(.title3.bold()).foregroundStyle(cor)
            }
            conteudo()
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Tema.cartao, in: RoundedRectangle(cornerRadius: 20))
        .background((tom ?? .clear).opacity(0.07), in: RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke((tom ?? Tema.texto).opacity(tom == nil ? 0.07 : 0.22), lineWidth: 1))
    }
}

private struct BlocoAnalise: View {
    let analise: AnaliseIA

    private var corAvaliacao: Color {
        switch analise.avaliacao {
        case "excelente": Tema.aqua
        case "bom": Tema.azul
        case "regular": Tema.laranja
        default: Tema.vermelho
        }
    }

    var body: some View {
        Secao(titulo: "Treinador IA", icone: "sparkles", tom: Tema.laranja) {
            HStack(alignment: .firstTextBaseline) {
                Text(analise.tipoSessao).font(.headline).foregroundStyle(Tema.texto)
                Spacer()
                Selo(texto: analise.avaliacao, cor: corAvaliacao)
            }
            Text(analise.resumo).font(.subheadline).foregroundStyle(Tema.texto)
            ForEach(analise.pontosPositivos, id: \.self) { p in
                Label { Text(p).font(.subheadline) } icon: { Image(systemName: "checkmark.circle.fill").foregroundStyle(Tema.aqua) }
            }
            ForEach(analise.pontosAtencao, id: \.self) { p in
                Label { Text(p).font(.subheadline) } icon: { Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Tema.laranja) }
            }
            if let m = analise.metricasRelogio, !m.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("MÉTRICAS DO RELÓGIO").font(.caption.weight(.heavy)).foregroundStyle(Tema.azul)
                    Text(m).font(.subheadline).foregroundStyle(Tema.texto)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Tema.azul.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("PRÓXIMO TREINO").font(.caption.weight(.heavy)).foregroundStyle(Tema.textoSuave)
                Text(analise.recomendacao).font(.subheadline).foregroundStyle(Tema.texto)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Tema.fundo, in: RoundedRectangle(cornerRadius: 12))
        }
    }
}

private struct BlocoComparacao: View {
    let comparacao: ComparacaoResultado
    let planejado: PlanejadoResultado

    private func cor(_ status: String) -> Color {
        switch status {
        case "dentro": Tema.aqua
        case "rapido": Tema.azul
        case "lento": Tema.laranja
        default: Tema.cinzaPausa
        }
    }

    /// Etapas com pace executado e faixa planejada: só essas entram no gráfico.
    private var pontos: [(rotulo: String, linha: LinhaComparacao)] {
        var esforco = 0
        return comparacao.linhas.compactMap { l in
            if l.papel == "trabalho" { esforco += 1 }
            guard l.execSeg != nil, l.planRapidoSeg != nil, l.planLentoSeg != nil else { return nil }
            let curto: String
            switch l.papel {
            case "aquecimento": curto = "Aquec."
            case "desaquecimento": curto = "Desaq."
            case "recuperacao": curto = "Rec."
            case "km": curto = l.rotulo.replacingOccurrences(of: "Km ", with: "")
            default: curto = "E\(esforco)"
            }
            return (curto, l)
        }
    }

    /// Velocidade em km/h: barra mais alta = mais rápido (o contrário do pace, que é menor quando se corre mais rápido).
    private func velocidade(_ pace: Double) -> Double { 3600 / pace }

    private var textoResumo: String {
        let r = comparacao.resumo
        let unidade = comparacao.base == "km" ? "km" : (r.avaliadas == 1 ? "esforço" : "esforços")
        return "\(planejado.titulo) · \(r.dentro) de \(r.avaliadas) \(unidade) na faixa"
    }

    var body: some View {
        Secao(titulo: "Planejado × executado", icone: "target", tom: Tema.roxo) {
            Text(textoResumo).font(.subheadline).foregroundStyle(Tema.textoSuave)

            if !pontos.isEmpty {
                let maxVel = (pontos.flatMap { [velocidade($0.linha.planRapidoSeg ?? 600), velocidade($0.linha.execSeg ?? 600)] }.max() ?? 12) * 1.18
                Chart {
                    ForEach(pontos, id: \.linha.id) { p in
                        let l = p.linha
                        // planejado, atrás: coluna cinza até o limite lento e, por cima, a faixa entre o lento e o rápido
                        BarMark(x: .value("Etapa", p.rotulo), yStart: .value("base", 0), yEnd: .value("lento", velocidade(l.planLentoSeg ?? 600)), width: .ratio(0.78))
                            .foregroundStyle(Tema.cinzaPausa.opacity(0.28))
                        BarMark(x: .value("Etapa", p.rotulo), yStart: .value("lento", velocidade(l.planLentoSeg ?? 600)), yEnd: .value("rápido", velocidade(l.planRapidoSeg ?? 600)), width: .ratio(0.78))
                            .foregroundStyle(Tema.roxo.opacity(0.38))
                        // executado, na frente e translúcido: passou da faixa ou ficou aquém?
                        BarMark(x: .value("Etapa", p.rotulo), yStart: .value("base", 0), yEnd: .value("executado", velocidade(l.execSeg ?? 600)), width: .ratio(0.44))
                            .foregroundStyle(cor(l.status).opacity(0.62))
                            .annotation(position: .top, spacing: 2) {
                                Text(formatarPace(l.execSeg)).font(.caption2.weight(.semibold)).foregroundStyle(Tema.texto)
                            }
                    }
                }
                .chartYScale(domain: 0...maxVel)
                .chartYAxis {
                    AxisMarks { v in
                        AxisGridLine()
                        AxisValueLabel { if let d = v.as(Double.self) { Text("\(Int(d)) km/h").font(.caption2) } }
                    }
                }
                .frame(height: 230)

                HStack(spacing: 12) {
                    legenda(Tema.cinzaPausa.opacity(0.4), "plano")
                    legenda(Tema.roxo.opacity(0.5), "faixa do plano")
                    legenda(Tema.aqua, "dentro")
                    legenda(Tema.azul, "mais rápido")
                    legenda(Tema.laranja, "mais lento")
                }
                .font(.caption2).foregroundStyle(Tema.textoSuave)
                Text("Barra mais alta = mais rápido. A barra colorida é o que você correu; quando passa do topo da faixa roxa, foi mais rápido que o plano.")
                    .font(.caption).foregroundStyle(Tema.textoSuave)
            }

            ForEach(comparacao.linhas) { l in
                HStack {
                    Text(l.rotulo).font(.subheadline.weight(.medium)).foregroundStyle(Tema.texto)
                    Spacer()
                    VStack(alignment: .trailing, spacing: 1) {
                        Text(l.execSeg.map { "\(formatarPace($0)) /km" } ?? "—").font(.subheadline.weight(.semibold)).monospacedDigit()
                        if let r = l.planRapidoSeg, let lt = l.planLentoSeg {
                            Text("plano \(formatarPace(r))–\(formatarPace(lt))").font(.caption2).foregroundStyle(Tema.textoSuave).monospacedDigit()
                        }
                    }
                    Circle().fill(cor(l.status)).frame(width: 9, height: 9)
                }
            }
        }
    }

    private func legenda(_ cor: Color, _ texto: String) -> some View {
        HStack(spacing: 4) {
            RoundedRectangle(cornerRadius: 2).fill(cor).frame(width: 10, height: 10)
            Text(texto)
        }
    }
}

private struct BlocoGraficos: View {
    private let entrada: [PontoSerie]
    /// km escolhido ao tocar ou arrastar em qualquer um dos gráficos (a linha aparece nos três)
    @State private var kmSel: Double?
    /// 0 = original, 1 = suave, 2 = muito suave (janela em km, em cima da suavização que já existe)
    @State private var suavizacao = 1
    private static let janelas: [Double] = [0, 0.3, 0.8]

    init(serie: [PontoSerie]) { entrada = serie }

    /// Série com o pace suavizado pela distância: média das velocidades na janela, e só depois vira pace.
    private var serie: [PontoSerie] {
        let janela = Self.janelas[suavizacao]
        guard janela > 0, entrada.count > 3 else { return entrada }
        let n = entrada.count
        // somas acumuladas da velocidade (pontos sem pace não entram)
        var soma = [Double](repeating: 0, count: n + 1), cont = [Int](repeating: 0, count: n + 1)
        for i in 0..<n {
            let v = entrada[i].pace.map { 1000 / $0 }
            soma[i + 1] = soma[i] + (v ?? 0)
            cont[i + 1] = cont[i] + (v == nil ? 0 : 1)
        }
        var lo = 0, hi = 0
        return entrada.enumerated().map { i, p in
            guard p.pace != nil else { return p }
            while entrada[lo].km < p.km - janela / 2 { lo += 1 }
            while hi < n - 1, entrada[hi + 1].km <= p.km + janela / 2 { hi += 1 }
            let c = cont[hi + 1] - cont[lo]
            var q = p
            if c > 0 { q.pace = (1000 / ((soma[hi + 1] - soma[lo]) / Double(c))).rounded() }
            return q
        }
    }

    /// Inclinação (%) em cada ponto: variação de altitude numa janela de ~300 m ao redor.
    private func inclinacao(_ i: Int, _ pts: [PontoSerie]) -> Double? {
        guard pts[i].alt != nil else { return nil }
        var a = i, b = i
        while a > 0, pts[i].km - pts[a].km < 0.15 { a -= 1 }
        while b < pts.count - 1, pts[b].km - pts[i].km < 0.15 { b += 1 }
        guard let altA = pts[a].alt, let altB = pts[b].alt, pts[b].km > pts[a].km else { return nil }
        return (altB - altA) / ((pts[b].km - pts[a].km) * 1000) * 100
    }

    private func inclinacaoTexto(_ v: Double) -> String {
        (v > 0.05 ? "+" : "") + String(format: "%.1f", v).replacingOccurrences(of: ".", with: ",") + "%"
    }

    private func corInclinacao(_ v: Double) -> Color {
        v > 6 ? Tema.vermelho : v > 2 ? Tema.laranja : v < -2 ? Tema.azul : Tema.textoSuave
    }

    private var paces: [Double] { serie.compactMap(\.pace) }
    private var fcs: [Double] { serie.compactMap(\.fc) }
    private var alts: [Double] { serie.compactMap(\.alt) }

    private func percentil(_ v: [Double], _ p: Double) -> Double {
        let o = v.sorted()
        return o[min(o.count - 1, max(0, Int((p * Double(o.count - 1)).rounded())))]
    }

    private struct PontoPace: Identifiable {
        let km: Double
        let y: Double
        let trecho: Int
        var id: Double { km }
    }

    /// Pace (negativo, para o eixo invertido) preso ao intervalo do eixo e separado em trechos contínuos.
    private func segmentos(lo: Double, hi: Double) -> [PontoPace] {
        var saida: [PontoPace] = []
        var trecho = 0
        for p in serie {
            guard let pace = p.pace else { trecho += 1; continue }
            saida.append(PontoPace(km: p.km, y: -min(max(pace, lo), hi), trecho: trecho))
        }
        return saida
    }

    /// Ponto da série mais perto do km tocado.
    private var pontoSel: PontoSerie? {
        guard let k = kmSel else { return nil }
        return serie.min { abs($0.km - k) < abs($1.km - k) }
    }

    private var inclinacaoSel: Double? {
        guard let k = kmSel else { return nil }
        let pts = serie
        guard let i = pts.indices.min(by: { abs(pts[$0].km - k) < abs(pts[$1].km - k) }) else { return nil }
        return inclinacao(i, pts)
    }

    /// Maior subida e descida da corrida (% numa janela de ~300 m).
    private var extremos: (sobe: Double, desce: Double)? {
        let pts = serie
        let v = pts.indices.compactMap { inclinacao($0, pts) }
        guard let mx = v.max(), let mn = v.min() else { return nil }
        return (mx, mn)
    }

    private func kmTexto(_ km: Double) -> String { String(format: "%.2f km", km).replacingOccurrences(of: ".", with: ",") }

    /// Os três gráficos usam o mesmo eixo de km e a mesma largura de rótulos do eixo Y, para ficarem alinhados.
    private var kmTotal: Double { max(serie.last?.km ?? 1, 1) }
    private var marcasKm: [Double] {
        let passo: Double = kmTotal > 30 ? 10 : kmTotal > 14 ? 5 : kmTotal > 6 ? 2 : 1
        return Array(stride(from: 0, through: kmTotal, by: passo))
    }

    private func eixoYAlinhado(_ formatar: @escaping (Double) -> String) -> some AxisContent {
        AxisMarks { v in
            AxisGridLine()
            AxisValueLabel {
                if let d = v.as(Double.self) {
                    Text(formatar(d)).font(.caption2).frame(width: 44, alignment: .leading)
                }
            }
        }
    }

    private var eixoXKm: some AxisContent {
        AxisMarks(values: marcasKm) { v in
            AxisValueLabel { if let d = v.as(Double.self) { Text("\(Int(d)) km").font(.caption2) } }
        }
    }

    var body: some View {
        Secao(titulo: "Ritmo, FC e altitude", icone: "waveform.path.ecg", tom: Tema.azul) {
            // leitura do ponto tocado: fica fixa no topo para não cobrir os gráficos
            Group {
                if let p = pontoSel {
                    HStack(spacing: 14) {
                        Text(kmTexto(p.km)).font(.subheadline.weight(.bold)).foregroundStyle(Tema.texto)
                        if let v = p.pace { Text("\(formatarPace(v)) /km").foregroundStyle(Tema.azul) }
                        if let v = p.fc { Text("\(Int(v)) bpm").foregroundStyle(Tema.vermelho) }
                        if let v = p.alt { Text("\(Int(v.rounded())) m").foregroundStyle(Tema.textoSuave) }
                        if let g = inclinacaoSel { Text(inclinacaoTexto(g)).foregroundStyle(corInclinacao(g)) }
                    }
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                } else {
                    Text("Toque e arraste nos gráficos para ver o km, o pace, a FC, a altitude e a inclinação de cada ponto.")
                        .font(.caption).foregroundStyle(Tema.textoSuave)
                }
            }
            .frame(minHeight: 22, alignment: .leading)

            HStack(spacing: 8) {
                Text("Suavizar pace").font(.caption).foregroundStyle(Tema.textoSuave)
                Picker("Suavizar", selection: $suavizacao) {
                    Text("Original").tag(0)
                    Text("Suave").tag(1)
                    Text("Muito suave").tag(2)
                }
                .pickerStyle(.segmented)
            }

            if !paces.isEmpty {
                Text("PACE").font(.caption.weight(.heavy)).foregroundStyle(Tema.azul)
                let lo = (percentil(paces, 0.03) / 10).rounded(.down) * 10 - 10
                let hi = (percentil(paces, 0.97) / 10).rounded(.up) * 10 + 10
                Chart {
                    // cada trecho contínuo é uma linha; paradas (sem pace) quebram a linha em vez de cruzar o gráfico
                    ForEach(segmentos(lo: lo, hi: hi)) { p in
                        LineMark(x: .value("km", p.km), y: .value("pace", p.y), series: .value("trecho", p.trecho))
                            .foregroundStyle(Tema.azul)
                            .interpolationMethod(.monotone)
                    }
                    if let p = pontoSel {
                        RuleMark(x: .value("km", p.km)).foregroundStyle(Tema.texto.opacity(0.45)).lineStyle(StrokeStyle(lineWidth: 1))
                        if let v = p.pace {
                            PointMark(x: .value("km", p.km), y: .value("pace", -min(max(v, lo), hi))).foregroundStyle(Tema.azul).symbolSize(70)
                        }
                    }
                }
                .chartXSelection(value: $kmSel)
                .chartXScale(domain: 0...kmTotal)
                .chartYScale(domain: -hi ... -lo)
                .chartYAxis { eixoYAlinhado { formatarPace(-$0) } }
                .chartXAxis(.hidden)
                .frame(height: 140)
            }
            if !fcs.isEmpty {
                Text("FREQUÊNCIA CARDÍACA").font(.caption.weight(.heavy)).foregroundStyle(Tema.vermelho)
                Chart {
                    ForEach(serie.filter { $0.fc != nil }) { p in
                        LineMark(x: .value("km", p.km), y: .value("fc", p.fc ?? 0))
                            .foregroundStyle(Tema.vermelho)
                            .interpolationMethod(.monotone)
                    }
                    if let p = pontoSel {
                        RuleMark(x: .value("km", p.km)).foregroundStyle(Tema.texto.opacity(0.45)).lineStyle(StrokeStyle(lineWidth: 1))
                        if let v = p.fc { PointMark(x: .value("km", p.km), y: .value("fc", v)).foregroundStyle(Tema.vermelho).symbolSize(70) }
                    }
                }
                .chartXSelection(value: $kmSel)
                .chartXScale(domain: 0...kmTotal)
                .chartYScale(domain: ((fcs.min() ?? 60) - 5)...((fcs.max() ?? 180) + 5))
                .chartYAxis { eixoYAlinhado { String(Int($0.rounded())) } }
                .chartXAxis(.hidden)
                .frame(height: 120)
            }
            if !alts.isEmpty {
                Text("ALTITUDE").font(.caption.weight(.heavy)).foregroundStyle(Tema.textoSuave)
                let base = (alts.min() ?? 0) - 5
                Chart {
                    ForEach(serie.filter { $0.alt != nil }) { p in
                        AreaMark(x: .value("km", p.km), yStart: .value("base", base), yEnd: .value("alt", p.alt ?? 0))
                            .foregroundStyle(Tema.cinzaPausa.opacity(0.35))
                    }
                    if let p = pontoSel {
                        RuleMark(x: .value("km", p.km)).foregroundStyle(Tema.texto.opacity(0.45)).lineStyle(StrokeStyle(lineWidth: 1))
                        if let v = p.alt { PointMark(x: .value("km", p.km), y: .value("alt", v)).foregroundStyle(Tema.texto.opacity(0.7)).symbolSize(70) }
                    }
                }
                .chartXSelection(value: $kmSel)
                .chartXScale(domain: 0...kmTotal)
                .chartYScale(domain: base...((alts.max() ?? 0) + 5))
                .chartYAxis { eixoYAlinhado { String(Int($0.rounded())) } }
                .chartXAxis { eixoXKm }
                .frame(height: 110)
                if let e = extremos, e.sobe > 1 || e.desce < -1 {
                    HStack(spacing: 14) {
                        Label("Maior subida \(inclinacaoTexto(e.sobe))", systemImage: "arrow.up.right").foregroundStyle(corInclinacao(e.sobe))
                        Label("Maior descida \(inclinacaoTexto(e.desce))", systemImage: "arrow.down.right").foregroundStyle(corInclinacao(e.desce))
                    }
                    .font(.caption.weight(.semibold))
                    .monospacedDigit()
                }
            }
        }
    }
}

private struct BlocoZonas: View {
    let zonas: ZonasResultado
    @State private var aba = 0

    private func cor(_ ordem: Int, pace: Bool) -> Color {
        if pace {
            switch ordem {
            case 0: Tema.cinzaPausa
            case 1: Zona.z1.cor
            case 2: Zona.z2.cor
            case 3: Zona.z3.cor
            case 4: Zona.z4.cor
            case 5: Zona.z5.cor
            default: Zona.z6.cor
            }
        } else {
            [Tema.azul, Tema.aqua, Color(red: 0.80, green: 0.68, blue: 0.20), Tema.laranja, Tema.vermelho][min(max(ordem - 1, 0), 4)]
        }
    }

    var body: some View {
        if zonas.pace != nil || zonas.fc != nil {
            Secao(titulo: "Tempo por zona", icone: "chart.bar.fill", tom: Tema.aqua) {
                if zonas.pace != nil && zonas.fc != nil {
                    Picker("Zona", selection: $aba) {
                        Text("Pace").tag(0)
                        Text("Freq. cardíaca").tag(1)
                    }
                    .pickerStyle(.segmented)
                }
                let usarPace = (aba == 0 && zonas.pace != nil) || zonas.fc == nil
                let linhas = (usarPace ? zonas.pace : zonas.fc) ?? []
                ForEach(linhas) { l in
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(l.id == "—" ? l.nome : "\(l.id) · \(l.nome)").font(.subheadline.weight(.medium)).foregroundStyle(Tema.texto).lineLimit(1)
                            Text(l.faixa).font(.caption2).foregroundStyle(Tema.textoSuave)
                        }
                        .frame(width: 130, alignment: .leading)
                        GeometryReader { g in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Tema.fundo)
                                Capsule().fill(cor(l.ordem, pace: usarPace)).frame(width: max(g.size.width * l.pct / 100, l.pct > 0 ? 6 : 0))
                            }
                        }
                        .frame(height: 10)
                        VStack(alignment: .trailing, spacing: 0) {
                            Text("\(Int(l.pct.rounded()))%").font(.subheadline.weight(.semibold)).monospacedDigit()
                            Text(formatarDuracao(l.seg)).font(.caption2).foregroundStyle(Tema.textoSuave).monospacedDigit()
                        }
                        .frame(width: 48, alignment: .trailing)
                    }
                }
                if !usarPace {
                    Text("Zonas por % da FC máxima (\(Int(zonas.fcMaxima)) bpm)").font(.caption2).foregroundStyle(Tema.textoSuave)
                }
            }
        }
    }
}

private enum Granularidade: String, CaseIterable, Identifiable {
    case km = "1 km"
    case intervalos = "Intervalos"
    var id: String { rawValue }
}

/// O que se pode sobrepor às barras de variação de pace.
private enum Sobreposicao: String, CaseIterable, Identifiable {
    case nenhuma = "Nenhuma"
    case altitude = "Altitude"
    case inclinacao = "Inclinação"
    case fc = "Freq. cardíaca"
    case potencia = "Potência"
    case cadencia = "Cadência"
    case contato = "Contato com o solo"
    case oscilacao = "Oscilação vertical"
    case passada = "Passada"
    var id: String { rawValue }
    var unidade: String {
        switch self {
        case .nenhuma: ""
        case .altitude: "m"
        case .inclinacao: "%"
        case .fc: "bpm"
        case .potencia: "W"
        case .cadencia: "ppm"
        case .contato: "ms"
        case .oscilacao: "cm"
        case .passada: "m"
        }
    }
    var cor: Color {
        switch self {
        case .altitude: Tema.aqua
        case .inclinacao: Tema.laranja
        case .fc: Tema.vermelho
        case .potencia: Tema.roxo
        default: Tema.azul
        }
    }
}

/// Uma barra do gráfico: um km, ou uma etapa do treino.
private struct BarraSplit: Identifiable {
    let id: Int
    let rotulo: String
    let titulo: String
    let pace: Double?
    var fc: Double?
    var altDelta: Double?
    var inclinacao: Double?
    var potencia: Double?
    var cadencia: Double?
    var contato: Double?
    var oscilacao: Double?
    var passada: Double?

    func valor(_ s: Sobreposicao) -> Double? {
        switch s {
        case .nenhuma: nil
        case .altitude: altDelta
        case .inclinacao: inclinacao
        case .fc: fc
        case .potencia: potencia
        case .cadencia: cadencia
        case .contato: contato
        case .oscilacao: oscilacao
        case .passada: passada
        }
    }
}

private struct BlocoSplits: View {
    let splits: [SplitKm]
    let voltas: [VoltaResultado]
    let serie: [PontoSerie]

    @State private var granularidade: Granularidade = .km
    @State private var sobreposicao: Sobreposicao = .nenhuma
    @State private var selecionado: Int?

    private var temIntervalos: Bool { voltas.count > 1 }
    private var completos: [SplitKm] { splits.filter { $0.distanciaM >= 950 } }

    // MARK: dados

    /// Altitude interpolada num ponto da corrida (km), pela série ao longo da distância.
    private func altitudeEm(_ km: Double) -> Double? {
        let pts = serie.filter { $0.alt != nil }
        guard pts.count >= 2, let primeiro = pts.first, let ultimo = pts.last else { return nil }
        if km <= primeiro.km { return primeiro.alt }
        if km >= ultimo.km { return ultimo.alt }
        guard let i = pts.firstIndex(where: { $0.km >= km }), i > 0 else { return nil }
        let a = pts[i - 1], b = pts[i]
        let t = b.km > a.km ? (km - a.km) / (b.km - a.km) : 0
        return (a.alt ?? 0) + ((b.alt ?? 0) - (a.alt ?? 0)) * t
    }

    private func delta(de: Double, ate: Double) -> Double? {
        guard let a = altitudeEm(de), let b = altitudeEm(ate) else { return nil }
        return b - a
    }

    private var barras: [BarraSplit] {
        if granularidade == .km || !temIntervalos {
            var acumulado = 0.0
            return completos.map { s in
                let ini = acumulado
                acumulado += s.distanciaM / 1000
                var b = BarraSplit(id: s.km, rotulo: String(s.km), titulo: "Km \(s.km)", pace: s.paceSegKm)
                b.fc = s.fcMedia
                b.altDelta = delta(de: ini, ate: acumulado)
                b.inclinacao = b.altDelta.map { $0 / max(s.distanciaM, 1) * 100 }
                return b
            }
        }
        var acumulado = 0.0
        var esforco = 0
        return voltas.enumerated().map { i, v in
            let ini = acumulado
            acumulado += v.distanciaM / 1000
            let curto: String
            switch v.rotulo {
            case "Aquecimento": curto = "Aq."
            case "Desaquecimento": curto = "Des."
            case "Descanso", "Recuperação": curto = "·"
            case "Esforço": esforco += 1; curto = "E\(esforco)"
            default: curto = String(i + 1)
            }
            var b = BarraSplit(id: i + 1, rotulo: curto, titulo: v.rotulo, pace: v.distanciaM >= 150 ? v.tempoSeg / (v.distanciaM / 1000) : nil)
            b.fc = v.fcMedia
            b.altDelta = delta(de: ini, ate: acumulado)
            b.inclinacao = b.altDelta.map { $0 / max(v.distanciaM, 1) * 100 }
            b.potencia = v.potenciaW
            b.cadencia = v.cadencia
            b.contato = v.contatoMs
            b.oscilacao = v.oscilacaoCm
            b.passada = v.passadaM
            return b
        }
    }

    private var paces: [Double] { barras.compactMap(\.pace) }

    /// Mediana (como no Fitness): mais estável que a média quando há um km parado.
    private var mediana: Double? {
        let o = paces.sorted()
        guard !o.isEmpty else { return nil }
        return o.count % 2 == 1 ? o[o.count / 2] : (o[o.count / 2 - 1] + o[o.count / 2]) / 2
    }

    private var tolerancia: Double { max(3, (mediana ?? 300) * 0.02) }
    private let limiteBarra = 120.0

    private func cor(_ pace: Double, media: Double) -> Color {
        let d = pace - media
        if d < -tolerancia { return Tema.azul }
        if d > tolerancia { return Tema.laranja }
        return Tema.cinzaPausa
    }

    private func clamp(_ v: Double) -> Double { max(-limiteBarra, min(limiteBarra, v)) }

    // MARK: sobreposição normalizada para a escala das barras

    private func faixaSobreposicao(_ lista: [BarraSplit]) -> (min: Double, max: Double)? {
        let v = lista.compactMap { $0.valor(sobreposicao) }
        guard let lo = v.min(), let hi = v.max() else { return nil }
        return (lo, hi)
    }

    private func posicao(_ v: Double, faixa: (min: Double, max: Double), topo: Double) -> Double {
        let t = faixa.max > faixa.min ? (v - faixa.min) / (faixa.max - faixa.min) : 0.5
        return topo * (0.15 + 0.80 * t) // fica na metade de cima, como no Fitness
    }

    private func formatar(_ v: Double, _ s: Sobreposicao) -> String {
        switch s {
        case .passada: String(format: "%.2f", v).replacingOccurrences(of: ".", with: ",")
        case .oscilacao: String(format: "%.1f", v).replacingOccurrences(of: ".", with: ",")
        case .altitude: (v > 0 ? "+" : "") + "\(Int(v.rounded()))"
        case .inclinacao: (v > 0.05 ? "+" : "") + String(format: "%.1f", v).replacingOccurrences(of: ".", with: ",")
        default: "\(Int(v.rounded()))"
        }
    }

    /// Opções de sobreposição que têm dado na granularidade escolhida.
    private func opcoes(_ lista: [BarraSplit]) -> [Sobreposicao] {
        Sobreposicao.allCases.filter { opcao in opcao == .nenhuma || lista.contains { b in b.valor(opcao) != nil } }
    }

    // MARK: vista

    var body: some View {
        let lista = barras
        let media = mediana
        let topo = max(15.0, min(limiteBarra, (lista.compactMap { $0.pace }.map { abs((media ?? $0) - $0) }.max() ?? 15) + 5))
        let faixa = faixaSobreposicao(lista)

        Secao(titulo: "Variação por \(granularidade == .km || !temIntervalos ? "km" : "etapa")", icone: "arrow.up.arrow.down", tom: Tema.laranja) {
            if temIntervalos && !completos.isEmpty {
                Picker("Agrupar por", selection: $granularidade) {
                    ForEach(Granularidade.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
            }

            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 0) {
                    Text("\(formatarPace(media)) /km").font(.title3.weight(.bold)).foregroundStyle(Tema.azul).monospacedDigit()
                    Text("Mediana").font(.caption).foregroundStyle(Tema.textoSuave)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 0) {
                    Text("\(formatarPace(paces.min())) /km").font(.title3.weight(.bold)).foregroundStyle(Tema.azul).monospacedDigit()
                    Text("Melhor").font(.caption).foregroundStyle(Tema.textoSuave)
                }
            }

            // sobrepor outra métrica às barras (linha verde, como no Fitness)
            HStack {
                Spacer()
                Menu {
                    Picker("Sobrepor", selection: $sobreposicao) {
                        ForEach(opcoes(lista)) { Text($0.rawValue).tag($0) }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text(sobreposicao == .nenhuma ? "Sobrepor" : sobreposicao.rawValue).fontWeight(.semibold)
                        Image(systemName: "chevron.down").font(.caption2)
                    }
                    .foregroundStyle(sobreposicao == .nenhuma ? Tema.textoSuave : sobreposicao.cor)
                }
            }

            if let media {
                Chart {
                    // faixa "no ritmo": quanto de variação ainda conta como o mesmo pace
                    RectangleMark(yStart: .value("a", -tolerancia), yEnd: .value("b", tolerancia))
                        .foregroundStyle(Tema.cinzaPausa.opacity(0.14))
                    RuleMark(y: .value("zero", 0)).foregroundStyle(Tema.cinzaPausa.opacity(0.5)).lineStyle(StrokeStyle(lineWidth: 0.8))

                    ForEach(lista) { b in
                        if let p = b.pace {
                            BarMark(x: .value("x", b.id), yStart: .value("zero", 0), yEnd: .value("diferença", clamp(media - p)), width: .fixed(larguraBarra(lista.count)))
                                .foregroundStyle(cor(p, media: media))
                                .opacity(selecionado == nil || selecionado == b.id ? 1 : 0.35)
                                .cornerRadius(4)
                        }
                    }

                    if let f = faixa, sobreposicao != .nenhuma {
                        ForEach(lista) { b in
                            if let v = b.valor(sobreposicao) {
                                LineMark(x: .value("x", b.id), y: .value("sobreposição", posicao(v, faixa: f, topo: topo)), series: .value("s", "sobre"))
                                    .foregroundStyle(sobreposicao.cor)
                                    .lineStyle(StrokeStyle(lineWidth: 1.6))
                                PointMark(x: .value("x", b.id), y: .value("sobreposição", posicao(v, faixa: f, topo: topo)))
                                    .foregroundStyle(sobreposicao.cor)
                                    .symbolSize(32)
                            }
                        }
                    }

                    if let sel = selecionado, lista.contains(where: { $0.id == sel }) {
                        RuleMark(x: .value("x", sel)).foregroundStyle(Tema.texto.opacity(0.35)).lineStyle(StrokeStyle(lineWidth: 1))
                    }
                }
                .chartXSelection(value: $selecionado)
                .chartXScale(domain: (lista.first?.id ?? 1) - 1 ... (lista.last?.id ?? 1) + 1)
                .chartYScale(domain: -topo * 1.15 ... topo * 1.15)
                .chartYAxis(.hidden)
                .chartXAxis {
                    AxisMarks(values: marcas(lista)) { v in
                        AxisValueLabel {
                            if let d = v.as(Int.self), let b = lista.first(where: { $0.id == d }) { Text(b.rotulo).font(.caption2) }
                        }
                    }
                }
                .chartPlotStyle { $0.clipped() }
                .frame(height: 200)

                leitura(lista: lista, media: media)

                HStack(spacing: 14) {
                    Label("Mais rápido", systemImage: "circle.fill").foregroundStyle(Tema.azul)
                    Label("No ritmo", systemImage: "circle.fill").foregroundStyle(Tema.cinzaPausa)
                    Label("Mais lento", systemImage: "circle.fill").foregroundStyle(Tema.laranja)
                }
                .font(.caption2)
                if let f = faixa, sobreposicao != .nenhuma {
                    Text("\(sobreposicao.rawValue): \(formatar(f.min, sobreposicao))–\(formatar(f.max, sobreposicao)) \(sobreposicao.unidade) (a linha usa a própria escala)")
                        .font(.caption2).foregroundStyle(sobreposicao.cor)
                }
            }

            negativoOuPositivo
        }
    }

    private func larguraBarra(_ n: Int) -> CGFloat { n > 20 ? 6 : n > 12 ? 10 : 18 }

    private func marcas(_ lista: [BarraSplit]) -> [Int] {
        let passo = lista.count > 22 ? 5 : lista.count > 12 && granularidade == .km ? 2 : 1
        return lista.map(\.id).filter { $0 % passo == 0 || $0 == 1 }
    }

    @ViewBuilder
    private func leitura(lista: [BarraSplit], media: Double) -> some View {
        Group {
            if let k = selecionado, let b = lista.first(where: { $0.id == k }) {
                HStack(spacing: 12) {
                    Text(b.titulo).font(.subheadline.weight(.bold)).foregroundStyle(Tema.texto)
                    if let p = b.pace {
                        Text("\(formatarPace(p)) /km").foregroundStyle(Tema.azul)
                        let d = Int((p - media).rounded())
                        Text(abs(d) <= Int(tolerancia) ? "no ritmo" : (d < 0 ? "\(-d)s mais rápido" : "\(d)s mais lento")).foregroundStyle(Tema.textoSuave)
                    } else {
                        Text("sem pace (parado)").foregroundStyle(Tema.textoSuave)
                    }
                    if sobreposicao != .nenhuma, let v = b.valor(sobreposicao) {
                        Text("\(formatar(v, sobreposicao)) \(sobreposicao.unidade)").foregroundStyle(sobreposicao.cor)
                    }
                }
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
            } else {
                Text("Toque numa barra para ver os números.").font(.caption).foregroundStyle(Tema.textoSuave)
            }
        }
        .frame(minHeight: 22, alignment: .leading)
    }

    /// Primeira metade contra a segunda (pace médio ponderado pelos km)
    @ViewBuilder
    private var negativoOuPositivo: some View {
        if completos.count >= 4 {
            let meio = completos.count / 2
            let primeira = Array(completos[0..<meio]), segunda = Array(completos[(completos.count - meio)...])
            let p1 = primeira.reduce(0) { $0 + $1.tempoSeg } / (primeira.reduce(0) { $0 + $1.distanciaM } / 1000)
            let p2 = segunda.reduce(0) { $0 + $1.tempoSeg } / (segunda.reduce(0) { $0 + $1.distanciaM } / 1000)
            let dif = (p1 - p2) / p1 * 100
            Divider()
            Text(dif > 0 ? "Split negativo · \(String(format: "%.1f", dif).replacingOccurrences(of: ".", with: ","))%" : "Split positivo · \(String(format: "%.1f", -dif).replacingOccurrences(of: ".", with: ","))%")
                .font(.headline).foregroundStyle(Tema.texto)
            HStack(spacing: 10) {
                Metrica(titulo: "1ª metade", valor: "\(formatarPace(p1)) /km")
                Metrica(titulo: "2ª metade", valor: "\(formatarPace(p2)) /km")
            }
        }
    }
}

private struct BlocoVoltas: View {
    let voltas: [VoltaResultado]

    var body: some View {
        Secao(titulo: "Etapas", icone: "list.number", tom: Tema.roxo) {
            ForEach(voltas) { v in
                HStack {
                    Text(v.rotulo).font(.subheadline.weight(.medium)).foregroundStyle(Tema.texto)
                    Spacer()
                    VStack(alignment: .trailing, spacing: 1) {
                        Text(v.distanciaM >= 1000 ? String(format: "%.2f km", v.distanciaM / 1000).replacingOccurrences(of: ".", with: ",") : "\(Int(v.distanciaM)) m")
                            .font(.subheadline.weight(.semibold))
                        Text("\(formatarDuracao(v.tempoSeg)) · \(v.distanciaM >= 150 ? formatarPace(v.tempoSeg / (v.distanciaM / 1000)) + " /km" : "—")\(v.fcMedia.map { " · \(Int($0.rounded())) bpm" } ?? "")")
                            .font(.caption2).foregroundStyle(Tema.textoSuave).monospacedDigit()
                    }
                }
            }
        }
    }
}

private struct BlocoMetricas: View {
    let m: MetricasResultado

    private var itens: [(String, String)] {
        var r: [(String, String)] = []
        if let v = m.potenciaW { r.append(("Potência", "\(Int(v.rounded())) W")) }
        if let v = m.cadencia { r.append(("Cadência", "\(Int(v.rounded())) ppm")) }
        if let v = m.passadaM { r.append(("Passada", String(format: "%.2f m", v).replacingOccurrences(of: ".", with: ","))) }
        if let v = m.oscilacaoCm { r.append(("Oscilação vertical", String(format: "%.1f cm", v).replacingOccurrences(of: ".", with: ","))) }
        if let v = m.contatoMs { r.append(("Contato com o solo", "\(Int(v.rounded())) ms")) }
        if let v = m.fcMaxima { r.append(("FC máxima", "\(Int(v.rounded())) bpm")) }
        if let v = m.caloriasKcal { r.append(("Calorias ativas", "\(Int(v.rounded())) kcal")) }
        return r
    }

    var body: some View {
        if !itens.isEmpty {
            Secao(titulo: "Métricas do Apple Watch", icone: "applewatch", tom: Tema.vermelho) {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ForEach(itens, id: \.0) { Metrica(titulo: $0.0, valor: $0.1) }
                }
            }
        }
    }
}
