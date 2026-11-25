import SwiftUI

private let ptBR = Locale(identifier: "pt_BR")

// MARK: - Modelos e chamadas ao site

struct ModeloTreino: Codable, Identifiable {
    var id: String
    var nome: String
    var daniels: String
    var descricao: String
    var treino: Sessao
}

extension Servidor {
    static func listarModelosTreino() async throws -> [ModeloTreino] {
        struct Resposta: Decodable { var modelos: [ModeloTreino] }
        return try JSONDecoder().decode(Resposta.self, from: try await executar(try requisicao("api/treino-planejado"))).modelos
    }

    static func salvarPlanejado(_ s: Sessao, substituir: Bool) async throws {
        struct Corpo: Encodable { var intent = "salvar"; var treino: Sessao; var substituir: Bool }
        try await planejar(Corpo(treino: s, substituir: substituir))
    }

    static func moverPlanejado(de: String, para: String) async throws {
        struct Corpo: Encodable { var intent = "mover"; var de: String; var para: String }
        try await planejar(Corpo(de: de, para: para))
    }

    static func excluirPlanejado(data: String) async throws {
        struct Corpo: Encodable { var intent = "excluir"; var data: String }
        try await planejar(Corpo(data: data))
    }

    private static func planejar(_ corpo: some Encodable) async throws {
        var req = try requisicao("api/treino-planejado", metodo: "POST")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(corpo)
        do {
            _ = try await executar(req)
        } catch Erro.servidor(409) {
            throw ErroPlanejar.ocupado
        } catch Erro.servidor(404) {
            throw ErroPlanejar.sumiu
        }
    }
}

enum ErroPlanejar: LocalizedError {
    case ocupado, sumiu
    var errorDescription: String? {
        switch self {
        case .ocupado: "Esse dia já ganhou um treino no site. Puxe a tela Semana para atualizar."
        case .sumiu: "Esse treino não existe mais no site. Puxe a tela Semana para atualizar."
        }
    }
}

extension Sessao {
    /// Só corridas montadas à mão, de hoje em diante, podem ser mexidas pelo app.
    var editavelNoApp: Bool {
        origem == "manual" && !ehMusculacao && dataComoDate >= Calendar.current.startOfDay(for: Date())
    }

    static func chave(_ d: Date) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: d)
    }

    /// Título com os números do treino: "Longão 24 km", "Cruise 4 × 1.600 m", "Tempo run 20 min", "Fácil 8 km + 6 strides".
    func tituloAtualizado(de base: String) -> String {
        guard blocos.count <= 2, let primeiro = blocos.first, let trabalho = primeiro.etapas.first(where: { $0.papel == .trabalho }) else { return base }
        func trocar(_ t: String, _ padrao: String, _ novo: String) -> String {
            guard let r = t.range(of: padrao, options: .regularExpression) else { return t }
            return t.replacingCharacters(in: r, with: novo)
        }
        // vários ritmos por repetição (fartlek): só o "N ×"
        let meta: String = {
            if let d = trabalho.distanciaM {
                if d >= 1000, primeiro.repeticoes == 1 || d >= 3000 {
                    return (d / 1000).formatted(.number.precision(.fractionLength(0...1)).locale(ptBR)) + " km"
                }
                return Int(d).formatted(.number.locale(ptBR)) + " m"
            }
            return trabalho.descricaoMeta
        }()
        var t = base
        if primeiro.repeticoes > 1 {
            if primeiro.etapas.filter({ $0.papel == .trabalho }).count > 1 {
                t = trocar(t, #"\d+ × "#, "\(primeiro.repeticoes) × ")
            } else {
                t = trocar(t, #"\d+ × [\d.,]+ ?(km|min|m|s)\b"#, "\(primeiro.repeticoes) × \(meta)")
            }
        } else {
            t = trocar(t, trabalho.distanciaM != nil ? #"\d+(,\d+)? ?km\b"# : #"\d+ min\b"#, meta)
        }
        if blocos.count == 2 { t = trocar(t, #"\d+ strides"#, "\(blocos[1].repeticoes) strides") }
        return t
    }
}

/// O que a folha de planejamento vai fazer.
enum PlanejarAlvo: Identifiable {
    case novo(Date)
    case editar(Sessao)
    var id: String {
        switch self {
        case .novo(let d): "novo-\(Sessao.chave(d))"
        case .editar(let s): "editar-\(s.id)"
        }
    }
    var dia: Date {
        switch self {
        case .novo(let d): d
        case .editar(let s): s.dataComoDate
        }
    }
}

// MARK: - Folha: escolher modelo → ajustar

struct PlanejarTreinoView: View {
    let alvo: PlanejarAlvo
    var store: TreinosStore
    var aoSalvar: () -> Void = {}
    @Environment(\.dismiss) private var dismiss
    @State private var modelos: [ModeloTreino] = []
    @State private var erro: String?
    @State private var carregando = false

    var body: some View {
        NavigationStack {
            Group {
                switch alvo {
                case .editar(let s):
                    AjustarTreino(base: s, novo: false, store: store, concluir: fechar)
                case .novo(let dia):
                    escolha(dia)
                }
            }
            .background(Tema.fundo)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
            }
        }
        .preferredColorScheme(.light)
    }

    private func fechar() {
        dismiss()
        aoSalvar()
    }

    private func escolha(_ dia: Date) -> some View {
        ScrollView {
            LazyVStack(spacing: 8) {
                if let erro {
                    Label(erro, systemImage: "exclamationmark.triangle.fill").font(.footnote).foregroundStyle(.orange)
                    Button("Tentar de novo") { Task { await carregar() } }.buttonStyle(.bordered)
                }
                if carregando { ProgressView().padding(.top, 40) }
                ForEach(modelos) { m in
                    NavigationLink {
                        AjustarTreino(base: preparado(m, dia), novo: true, store: store, concluir: fechar)
                    } label: {
                        HStack(spacing: 12) {
                            IconeTreino(simbolo: m.treino.tipo.icone, cor: m.treino.tipo.cor)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(m.nome).font(.body.weight(.semibold)).foregroundStyle(Tema.texto)
                                Text(m.descricao).font(.caption).foregroundStyle(Tema.textoSuave).multilineTextAlignment(.leading)
                            }
                            Spacer(minLength: 4)
                            if m.daniels != "—" {
                                Text(m.daniels).font(.caption.weight(.heavy)).foregroundStyle(m.treino.tipo.cor)
                                    .frame(width: 26, height: 26).background(m.treino.tipo.cor.opacity(0.14), in: Circle())
                            }
                        }
                        .padding(.vertical, 12).padding(.leading, 22).padding(.trailing, 14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .cartaoTreino(cor: m.treino.tipo.cor)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(16)
        }
        .navigationTitle(dia.formatted(.dateTime.weekday(.wide).day().month().locale(ptBR)).capitalized)
        .navigationBarTitleDisplayMode(.inline)
        .task { await carregar() }
    }

    private func preparado(_ m: ModeloTreino, _ dia: Date) -> Sessao {
        var s = m.treino
        s.data = Sessao.chave(dia)
        s.id = "manual-\(s.data)"
        return s
    }

    private func carregar() async {
        guard modelos.isEmpty, !carregando else { return }
        carregando = true
        defer { carregando = false }
        do {
            modelos = try await Servidor.listarModelosTreino()
            erro = nil
        } catch {
            if !Task.isCancelled { erro = error.localizedDescription }
        }
    }
}

// MARK: - Ajuste dos números

private struct AjustarTreino: View {
    let base: Sessao
    let novo: Bool
    var store: TreinosStore
    var concluir: () -> Void

    @State private var s: Sessao
    @State private var tituloManual = false
    @State private var salvando = false
    @State private var erro: String?

    init(base: Sessao, novo: Bool, store: TreinosStore, concluir: @escaping () -> Void) {
        self.base = base
        self.novo = novo
        self.store = store
        self.concluir = concluir
        _s = State(initialValue: base)
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Selo(texto: s.tipo.rotulo, cor: s.tipo.cor)
                    TextField("Título", text: Binding(get: { s.titulo }, set: { s.titulo = String($0.prefix(80)); tituloManual = true }))
                        .font(.title2.weight(.heavy))
                        .foregroundStyle(Tema.texto)
                    HStack(spacing: 10) {
                        Metrica(titulo: "Distância", valor: s.kmTexto)
                        Metrica(titulo: "Duração", valor: s.duracaoTexto)
                    }
                    GraficoEstrutura(sessao: s, altura: 64)

                    if s.aquecimento != nil {
                        EditorEtapa(nome: "Aquecimento", etapa: Binding(get: { s.aquecimento! }, set: { s.aquecimento = $0; renomear() })).padding(14).cartao(raio: 16)
                    }
                    ForEach(s.blocos.indices, id: \.self) { b in bloco(b) }
                    if s.desaquecimento != nil {
                        EditorEtapa(nome: "Desaquecimento", etapa: Binding(get: { s.desaquecimento! }, set: { s.desaquecimento = $0; renomear() })).padding(14).cartao(raio: 16)
                    }

                    TextField("Observação (opcional)", text: Binding(get: { s.observacao ?? "" }, set: { s.observacao = $0.isEmpty ? nil : String($0.prefix(500)) }), axis: .vertical)
                        .lineLimit(1...4).padding(14).cartao(raio: 16)
                }
                .padding(16)
            }
            VStack(spacing: 8) {
                if let erro { Text(erro).font(.footnote).foregroundStyle(Tema.vermelho).multilineTextAlignment(.center) }
                Button { Task { await salvar() } } label: {
                    HStack { if salvando { ProgressView() }; Text(salvando ? "Salvando…" : (novo ? "Salvar treino" : "Salvar mudanças")) }
                }
                .buttonStyle(BotaoPrincipal())
                .disabled(salvando || s.titulo.trimmingCharacters(in: .whitespaces).isEmpty || (!novo && s == base))
            }
            .padding(16)
            .overlay(alignment: .top) { Divider() }
        }
        .background(Tema.fundo)
        .navigationTitle(s.dataComoDate.formatted(.dateTime.weekday(.wide).day().month().locale(ptBR)).capitalized)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func bloco(_ b: Int) -> some View {
        let repete = s.blocos[b].repeticoes > 1 || s.blocos[b].etapas.count > 1
        return VStack(alignment: .leading, spacing: 12) {
            if repete {
                Stepper(value: Binding(get: { s.blocos[b].repeticoes }, set: { s.blocos[b].repeticoes = $0; renomear() }), in: 1...30) {
                    Text("Repetir \(s.blocos[b].repeticoes)×").font(.headline).foregroundStyle(Tema.laranja)
                }
                Divider()
            }
            ForEach(s.blocos[b].etapas.indices, id: \.self) { e in
                EditorEtapa(nome: s.blocos[b].etapas[e].papel == .trabalho ? (repete ? "Esforço" : "Corrida") : "Pausa",
                            etapa: Binding(get: { s.blocos[b].etapas[e] }, set: { s.blocos[b].etapas[e] = $0; renomear() }))
                if e < s.blocos[b].etapas.count - 1 { Divider() }
            }
        }
        .padding(14)
        .cartao(raio: 16)
    }

    private func renomear() {
        guard !tituloManual else { return }
        s.titulo = s.tituloAtualizado(de: base.titulo)
    }

    private func salvar() async {
        salvando = true
        erro = nil
        do {
            try await Servidor.salvarPlanejado(s, substituir: !novo)
            await store.carregar()
            salvando = false
            concluir()
        } catch {
            salvando = false
            self.erro = error.localizedDescription
        }
    }
}

private struct EditorEtapa: View {
    let nome: String
    @Binding var etapa: Etapa

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if etapa.distanciaM != nil || etapa.tempoSeg != nil {
                Stepper { rotulo } onIncrement: { mudar(1) } onDecrement: { mudar(-1) }
            } else {
                rotulo
            }
            Menu {
                ForEach(Zona.allCases, id: \.self) { z in
                    Button { trocarZona(z) } label: { Text("Z\(z.rawValue) \(z.nome) · \(z.pace)") }
                }
            } label: {
                HStack(spacing: 6) {
                    Circle().fill(etapa.zona?.cor ?? Tema.cinzaPausa).frame(width: 10, height: 10)
                    Text(etapa.zona.map { "Z\($0.rawValue) \($0.nome)" } ?? "Sem zona").font(.footnote.weight(.semibold))
                    if let p = etapa.textoPace { Text("\(p) /km").font(.footnote).monospacedDigit().foregroundStyle(Tema.textoSuave) }
                    Image(systemName: "chevron.up.chevron.down").font(.caption2).foregroundStyle(Tema.textoSuave)
                }
                .foregroundStyle(Tema.texto)
                .padding(.vertical, 6)
            }
            .accessibilityLabel("Zona de ritmo")
        }
    }

    private var rotulo: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(nome).font(.caption).foregroundStyle(Tema.textoSuave)
            Text(etapa.descricaoMeta).font(.headline).foregroundStyle(Tema.texto).monospacedDigit()
        }
    }

    /// Passo conforme o tamanho: tiros de 100 em 100 m, rodagens de 1 em 1 km; tempos curtos de 5 em 5 s.
    private func mudar(_ sinal: Double) {
        if let d = etapa.distanciaM {
            let passo: Double = sinal > 0 ? (d >= 3000 ? 1000 : (d >= 2000 ? 500 : 100)) : (d > 3000 ? 1000 : (d > 2000 ? 500 : 100))
            etapa.distanciaM = min(60_000, max(100, d + sinal * passo))
        } else if let t = etapa.tempoSeg {
            let passo: Double = sinal > 0 ? (t >= 300 ? 60 : (t >= 60 ? 30 : 5)) : (t > 300 ? 60 : (t > 60 ? 30 : 5))
            etapa.tempoSeg = min(4 * 3600, max(5, t + sinal * passo))
        }
    }

    private func trocarZona(_ z: Zona) {
        let l = TabelaZonas.limites[z.rawValue - 1]
        etapa.zona = z
        etapa.paceRapidoSeg = l.rapido
        etapa.paceLentoSeg = l.lento
    }
}

// MARK: - Mudar de dia

struct MudarDiaView: View {
    let sessao: Sessao
    var store: TreinosStore
    var concluir: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var salvando = false
    @State private var erro: String?

    var body: some View {
        let hoje = Calendar.current.startOfDay(for: Date())
        NavigationStack {
            List {
                Section {
                    ForEach(store.diasDaSemana.filter { $0 >= hoje }, id: \.self) { dia in
                        let chave = Sessao.chave(dia)
                        let corrida = store.sessoes(em: dia).first { !$0.ehMusculacao }
                        let mesmo = chave == sessao.data
                        // treino do plano da prova não troca de lugar
                        let bloqueado = corrida != nil && corrida?.origem != "manual"
                        Button { Task { await mover(chave) } } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(dia.formatted(.dateTime.weekday(.wide).day().month().locale(ptBR)).capitalized).foregroundStyle(Tema.texto)
                                    Text(mesmo ? "Dia atual" : (corrida.map { bloqueado ? "\($0.titulo) (plano da prova)" : "Troca com: \($0.titulo)" } ?? "Livre"))
                                        .font(.caption).foregroundStyle(Tema.textoSuave)
                                }
                                Spacer()
                                if mesmo { Image(systemName: "checkmark").foregroundStyle(Tema.aqua) }
                                else if corrida != nil, !bloqueado { Image(systemName: "arrow.left.arrow.right").foregroundStyle(Tema.laranja) }
                            }
                        }
                        .disabled(mesmo || bloqueado || salvando)
                    }
                } footer: {
                    if let erro { Text(erro).foregroundStyle(Tema.vermelho) } else { Text("Só os dias desta semana, de hoje em diante.") }
                }
            }
            .overlay { if salvando { ProgressView() } }
            .navigationTitle("Mudar de dia")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } } }
        }
        .preferredColorScheme(.light)
    }

    private func mover(_ para: String) async {
        salvando = true
        erro = nil
        do {
            try await Servidor.moverPlanejado(de: sessao.data, para: para)
            await store.carregar()
            salvando = false
            dismiss()
            concluir()
        } catch {
            salvando = false
            self.erro = error.localizedDescription
        }
    }
}
