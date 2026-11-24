import HealthKit
import SwiftUI
import WorkoutKit

private let ptBR = Locale(identifier: "pt_BR")

struct ContentView: View {
    @State private var store = TreinosStore()
    @State private var saude = SaudeSync()
    @State private var detalhe: Sessao?
    @State private var mostrarAjustes = false
    @State private var aba: Aba = .resultados
    @Environment(\.scenePhase) private var fase

    enum Aba { case resultados, hoje, semana }

    var body: some View {
        TabView(selection: $aba) {
            NavigationStack {
                ResultadosView(saude: saude, ajustes: { mostrarAjustes = true })
            }
            .tabItem { Label("Resultados", systemImage: "chart.xyaxis.line") }
            .tag(Aba.resultados)

            NavigationStack {
                HojeView(store: store, abrir: { detalhe = $0 }, ajustes: { mostrarAjustes = true })
            }
            .tabItem { Label("Hoje", systemImage: "clock") }
            .tag(Aba.hoje)

            NavigationStack {
                SemanaView(store: store, abrir: { detalhe = $0 }, ajustes: { mostrarAjustes = true })
            }
            .tabItem { Label("Semana", systemImage: "calendar") }
            .tag(Aba.semana)
        }
        .tint(Tema.texto)
        .preferredColorScheme(.light)
        .sheet(item: $detalhe) { s in
            DetalheView(store: store, sessao: s)
        }
        .sheet(isPresented: $mostrarAjustes) {
            AjustesView(aoSalvar: { await store.carregar() }, aoLimpar: { await store.limparRelogio() }, saude: saude)
        }
        .task {
            if !Servidor.configurado { mostrarAjustes = true }
            await store.carregar()
        }
        // ao voltar para o app, busca de novo o planejado no site (e o que já está no relógio)
        .onChange(of: fase) { _, nova in
            if nova == .active, Servidor.configurado { Task { await store.carregar() } }
        }
    }
}

// MARK: - Hoje

struct HojeView: View {
    var store: TreinosStore
    var abrir: (Sessao) -> Void
    var ajustes: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                cabecalho
                avisos
                if !store.sessoesHoje.isEmpty {
                    ForEach(store.sessoesHoje) { s in
                        CartaoHoje(store: store, sessao: s, abrir: abrir)
                    }
                } else {
                    DiaLivre(proximo: store.restoDaSemana.first, abrir: abrir)
                }
                if !store.restoDaSemana.isEmpty { restoDaSemana }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
        }
        .background(Tema.fundo)
        .refreshable { await store.carregar() }
        .toolbar(.hidden, for: .navigationBar)
    }

    private var cabecalho: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
                Text(Date().formatted(.dateTime.weekday(.wide).day().month(.wide).locale(ptBR)).capitalized)
                    .font(.subheadline)
                    .foregroundStyle(Tema.textoSuave)
                Text("Hoje")
                    .font(.system(size: 40, weight: .heavy))
                    .foregroundStyle(Tema.texto)
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
    }

    @ViewBuilder private var avisos: some View {
        if let erro = store.erro {
            Label(erro, systemImage: "exclamationmark.triangle.fill")
                .font(.footnote)
                .foregroundStyle(Color.orange)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
        }
        if let p = store.info?.prova, let sem = store.info?.semana, sem.numero > 0 {
            VStack(alignment: .leading, spacing: 8) {
                Text(p.nome).font(.headline).foregroundStyle(Tema.texto)
                ProgressView(value: Double(sem.numero), total: Double(max(sem.totalSemanas, 1)))
                    .tint(Tema.lima)
                Text("Semana \(sem.numero) de \(sem.totalSemanas) · \(sem.fase)")
                    .font(.subheadline)
                    .foregroundStyle(Tema.textoSuave)
            }
            .padding(16)
            .cartao()
        }
        if let msg = store.mensagem {
            Text(msg)
                .font(.footnote)
                .foregroundStyle(Tema.textoSuave)
                .frame(maxWidth: .infinity, alignment: .center)
                .multilineTextAlignment(.center)
        }
    }

    private var restoDaSemana: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("Resto da semana").font(.title3.bold()).foregroundStyle(Tema.texto)
                Spacer()
                Text(String(format: "%.0f km", store.kmDaSemana))
                    .font(.subheadline)
                    .foregroundStyle(Tema.textoSuave)
            }
            VStack(spacing: 8) {
                ForEach(store.restoDaSemana) { s in LinhaDia(store: store, sessao: s) { abrir(s) } }
            }
        }
    }
}

struct CartaoHoje: View {
    var store: TreinosStore
    let sessao: Sessao
    var abrir: (Sessao) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 10) {
                Selo(texto: sessao.tipo.rotulo, cor: sessao.tipo.cor)
                Text("\(sessao.kmTexto) · \(sessao.duracaoTexto)")
                    .font(.subheadline)
                    .foregroundStyle(Tema.textoSuave)
                Spacer()
                if store.estaNoRelogio(sessao) {
                    Label("No relógio", systemImage: "applewatch.watchface")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Tema.aqua)
                }
            }

            Text(sessao.ehMusculacao ? sessao.titulo : (sessao.blocos.first.map { $0.repeticoes > 1 } == true ? (sessao.resumoTrabalho ?? sessao.titulo) : sessao.titulo))
                .font(.system(size: 34, weight: .heavy))
                .foregroundStyle(Tema.texto)
                .fixedSize(horizontal: false, vertical: true)

            if let pace = sessao.paceTrabalho {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Pace").font(.subheadline).foregroundStyle(Tema.textoSuave)
                    Text("\(pace) /km").font(.title3.weight(.bold)).foregroundStyle(Tema.texto).monospacedDigit()
                }
            }

            if !sessao.ehMusculacao { GraficoEstrutura(sessao: sessao) }

            HStack(spacing: 10) {
                Button {
                    Task { await store.enviar([sessao]) }
                } label: {
                    Text(store.estaNoRelogio(sessao) ? "Reenviar" : "Enviar para o relógio")
                }
                .buttonStyle(BotaoPrincipal())
                .disabled(store.enviando)

                Button("Detalhes") { abrir(sessao) }
                    .buttonStyle(BotaoSecundario())
                    .frame(maxWidth: 130)
            }
        }
        .padding(18)
        .cartao(raio: 24)
    }
}

struct DiaLivre: View {
    let proximo: Sessao?
    var abrir: (Sessao) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: "moon.zzz.fill").font(.title).foregroundStyle(Tema.cinzaPausa)
            Text("Dia livre").font(.title2.bold()).foregroundStyle(Tema.texto)
            if let proximo {
                Text("Próximo: \(proximo.titulo) · \(proximo.dataComoDate.formatted(.dateTime.weekday(.wide).locale(ptBR)))")
                    .font(.subheadline).foregroundStyle(Tema.textoSuave)
                Button("Ver treino") { abrir(proximo) }.buttonStyle(BotaoSecundario())
            } else {
                Text("Nenhum treino planejado. Monte a semana no site, em Treinos.")
                    .font(.subheadline).foregroundStyle(Tema.textoSuave)
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cartao(raio: 24)
    }
}

struct LinhaDia: View {
    var store: TreinosStore
    let sessao: Sessao
    var acao: () -> Void

    var body: some View {
        Button(action: acao) {
            HStack(spacing: 12) {
                Text(sessao.dataComoDate.formatted(.dateTime.weekday(.abbreviated).locale(ptBR)).capitalized.replacingOccurrences(of: ".", with: ""))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Tema.textoSuave)
                    .frame(width: 38, alignment: .leading)
                Circle().fill(sessao.tipo.cor).frame(width: 10, height: 10)
                VStack(alignment: .leading, spacing: 1) {
                    Text(sessao.titulo).font(.body.weight(.semibold)).foregroundStyle(Tema.texto).lineLimit(1)
                    Text(sessao.tipo.rotulo).font(.caption).foregroundStyle(Tema.textoSuave)
                }
                Spacer(minLength: 8)
                if store.estaNoRelogio(sessao) {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(Tema.aqua)
                }
                Text(sessao.kmTexto).font(.subheadline.weight(.medium)).foregroundStyle(Tema.texto).monospacedDigit()
            }
            .padding(.vertical, 14)
            .padding(.horizontal, 16)
            .cartao(raio: 16)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Semana

struct SemanaView: View {
    var store: TreinosStore
    var abrir: (Sessao) -> Void
    var ajustes: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(periodo).font(.subheadline).foregroundStyle(Tema.textoSuave)
                        Text("Semana").font(.system(size: 40, weight: .heavy)).foregroundStyle(Tema.texto)
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

                HStack {
                    Text("\(store.sessoes.count) treinos · \(String(format: "%.0f", store.kmDaSemana)) km")
                        .font(.subheadline).foregroundStyle(Tema.textoSuave)
                    Spacer()
                    Button {
                        Task { await store.enviar(store.sessoes) }
                    } label: {
                        Label("Enviar semana", systemImage: "applewatch").font(.subheadline.weight(.semibold))
                    }
                    .buttonStyle(.bordered)
                    .tint(Tema.texto)
                    .disabled(store.enviando || store.sessoes.isEmpty)
                }

                if let msg = store.mensagem {
                    Text(msg).font(.footnote).foregroundStyle(Tema.textoSuave)
                }

                VStack(spacing: 8) {
                    ForEach(store.diasDaSemana, id: \.self) { dia in
                        if !store.sessoes(em: dia).isEmpty {
                            DiaDaSemana(dia: dia) {
                                VStack(spacing: 6) {
                                    ForEach(store.sessoes(em: dia)) { s in
                                        LinhaCompacta(store: store, sessao: s) { abrir(s) }
                                    }
                                }
                            }
                        } else {
                            DiaDaSemana(dia: dia) {
                                HStack {
                                    Circle().fill(Tema.cinzaPausa).frame(width: 10, height: 10)
                                    Text("Descanso").font(.body.weight(.medium)).foregroundStyle(Tema.textoSuave)
                                    Spacer()
                                    Text("—").foregroundStyle(Tema.textoSuave)
                                }
                                .padding(.vertical, 14)
                                .padding(.horizontal, 16)
                                .cartao(raio: 16)
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
        }
        .background(Tema.fundo)
        .refreshable { await store.carregar() }
        .toolbar(.hidden, for: .navigationBar)
    }

    private var periodo: String {
        guard let a = store.diasDaSemana.first, let b = store.diasDaSemana.last else { return "" }
        return "\(a.formatted(.dateTime.day().locale(ptBR))) a \(b.formatted(.dateTime.day().month(.wide).locale(ptBR)))"
    }
}

struct DiaDaSemana<Conteudo: View>: View {
    let dia: Date
    @ViewBuilder var conteudo: () -> Conteudo

    var body: some View {
        let hoje = Calendar.current.isDateInToday(dia)
        HStack(alignment: .center, spacing: 12) {
            VStack(spacing: 0) {
                Text(dia.formatted(.dateTime.weekday(.abbreviated).locale(ptBR)).uppercased().replacingOccurrences(of: ".", with: ""))
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(Tema.textoSuave)
                Text(dia.formatted(.dateTime.day()))
                    .font(.title3.weight(.bold))
                    .foregroundStyle(Tema.texto)
            }
            .frame(width: 40)
            conteudo()
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(hoje ? Tema.texto : .clear, lineWidth: 1.5)
                )
        }
    }
}

struct LinhaCompacta: View {
    var store: TreinosStore
    let sessao: Sessao
    var acao: () -> Void

    var body: some View {
        Button(action: acao) {
            HStack(spacing: 12) {
                Circle().fill(sessao.tipo.cor).frame(width: 10, height: 10)
                VStack(alignment: .leading, spacing: 1) {
                    Text(sessao.titulo).font(.body.weight(.semibold)).foregroundStyle(Tema.texto).lineLimit(1)
                    Text([sessao.tipo.rotulo, sessao.paceTrabalho.map { "\($0) /km" }].compactMap { $0 }.joined(separator: " · "))
                        .font(.caption).foregroundStyle(Tema.textoSuave).lineLimit(1)
                }
                Spacer(minLength: 8)
                if store.estaNoRelogio(sessao) {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(Tema.aqua)
                }
                Text(sessao.kmTexto).font(.subheadline.weight(.medium)).foregroundStyle(Tema.texto).monospacedDigit()
            }
            .padding(.vertical, 14)
            .padding(.horizontal, 16)
            .cartao(raio: 16)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Detalhe

struct DetalheView: View {
    @Environment(\.dismiss) private var dismiss
    var store: TreinosStore
    let sessao: Sessao
    // A prévia do WorkoutKit precisa ser apresentada pela mesma folha que a abre; presa à tela raiz
    // ela ficava por baixo da folha de detalhe e o "X" não voltava para a tela inicial.
    @State private var planoPrevia: WorkoutPlan?
    @State private var mostrarPrevia = false

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    HStack {
                        Text(sessao.dataComoDate.formatted(.dateTime.weekday(.wide).day().month(.wide).locale(ptBR)).capitalized)
                            .font(.subheadline).foregroundStyle(Tema.textoSuave)
                        Spacer()
                        Button("Fechar") { dismiss() }.foregroundStyle(Tema.texto)
                    }

                    Selo(texto: sessao.tipo.rotulo, cor: sessao.tipo.cor)
                    Text(sessao.titulo)
                        .font(.system(size: 32, weight: .heavy))
                        .foregroundStyle(Tema.texto)
                        .fixedSize(horizontal: false, vertical: true)

                    if let obs = sessao.observacao, !obs.isEmpty {
                        Text(obs).font(.body).foregroundStyle(Tema.textoSuave)
                    }

                    HStack(spacing: 10) {
                        Metrica(titulo: "Distância", valor: sessao.kmTexto)
                        Metrica(titulo: "Duração", valor: sessao.duracaoTexto)
                        Metrica(titulo: "Esforço", valor: sessao.esforco)
                    }

                    if !sessao.ehMusculacao { GraficoEstrutura(sessao: sessao, altura: 84) }

                    VStack(spacing: 10) {
                        if let a = sessao.aquecimento { LinhaEtapa(etapa: a) }
                        ForEach(Array(sessao.blocos.enumerated()), id: \.offset) { _, b in
                            if b.repeticoes > 1 {
                                VStack(alignment: .leading, spacing: 12) {
                                    Text("REPETIR \(b.repeticoes)×")
                                        .font(.caption.weight(.heavy))
                                        .foregroundStyle(Tema.laranja)
                                    ForEach(Array(b.etapas.enumerated()), id: \.offset) { _, e in LinhaEtapa(etapa: e, semCartao: true) }
                                }
                                .padding(16)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Tema.laranja.opacity(0.07), in: RoundedRectangle(cornerRadius: 16))
                                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Tema.laranja.opacity(0.35), lineWidth: 1))
                            } else {
                                ForEach(Array(b.etapas.enumerated()), id: \.offset) { _, e in LinhaEtapa(etapa: e) }
                            }
                        }
                        if let d = sessao.desaquecimento { LinhaEtapa(etapa: d) }
                    }
                }
                .padding(20)
            }

            VStack(spacing: 8) {
                if let msg = store.mensagem {
                    Text(msg).font(.footnote).foregroundStyle(Tema.textoSuave).multilineTextAlignment(.center)
                }
                HStack(spacing: 10) {
                    Button("Prévia") {
                        planoPrevia = ConstrutorWorkout.plano(para: sessao)
                        mostrarPrevia = true
                    }
                        .buttonStyle(BotaoSecundario())
                        .frame(maxWidth: 120)
                    Button {
                        Task { await store.enviar([sessao]) }
                    } label: {
                        Text(store.estaNoRelogio(sessao) ? "Reenviar" : "Enviar para o relógio")
                    }
                    .buttonStyle(BotaoPrincipal())
                    .disabled(store.enviando)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 12)
            .background(Tema.fundo)
            .overlay(alignment: .top) { Divider() }
        }
        .background(Tema.fundo)
        .preferredColorScheme(.light)
        .workoutPreview(planoPrevia ?? ConstrutorWorkout.plano(para: sessao), isPresented: $mostrarPrevia)
    }
}

struct Metrica: View {
    let titulo: String
    let valor: String
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(titulo).font(.caption).foregroundStyle(Tema.textoSuave)
            Text(valor).font(.headline).foregroundStyle(Tema.texto).lineLimit(1).minimumScaleFactor(0.8)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cartao(raio: 14)
    }
}

struct LinhaEtapa: View {
    let etapa: Etapa
    var semCartao = false

    private var nome: String {
        if let n = etapa.nome, !n.isEmpty { return n }
        switch etapa.papel {
        case .trabalho: return "Esforço"
        default: return etapa.papel.rotulo
        }
    }

    /// série de musculação sem meta: no relógio você toca para avançar
    private var meta: String {
        if etapa.nome != nil, etapa.papel == .trabalho, etapa.distanciaM == nil, etapa.tempoSeg == nil { return "série" }
        return etapa.descricaoMeta
    }

    var body: some View {
        let conteudo = HStack(spacing: 12) {
            Circle().fill(etapa.papel.cor).frame(width: 12, height: 12)
            VStack(alignment: .leading, spacing: 2) {
                Text(nome).font(.body.weight(.semibold)).foregroundStyle(Tema.texto)
                Text(meta).font(.subheadline).foregroundStyle(Tema.textoSuave)
            }
            Spacer(minLength: 8)
            if let p = etapa.textoPace {
                VStack(alignment: .trailing, spacing: 1) {
                    Text("\(p) /km").font(.subheadline.weight(.bold)).foregroundStyle(Tema.texto).monospacedDigit()
                    if let z = etapa.zona {
                        Text("Z\(z.rawValue) · \(z.nome)").font(.caption).foregroundStyle(Tema.textoSuave)
                    }
                }
            }
        }
        if semCartao {
            conteudo
        } else {
            conteudo.padding(16).cartao(raio: 16)
        }
    }
}

// MARK: - Ajustes

struct AjustesView: View {
    @Environment(\.dismiss) private var dismiss
    var aoSalvar: () async -> Void
    var aoLimpar: () async -> Void
    var saude: SaudeSync

    @State private var confirmandoLimpeza = false
    @State private var confirmandoHistorico = false
    @State private var anoEscolhido = Calendar.current.component(.year, from: Date())
    @State private var limpo = false
    @AppStorage("autoEnvioRelogio") private var envioAutomatico = true
    @State private var endereco = Servidor.endereco
    @State private var token = Servidor.token ?? ""
    @State private var testando = false
    @State private var resultado: String?
    @State private var deuCerto = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Site") {
                    TextField("Endereço", text: $endereco)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                }
                Section {
                    SecureField("Token", text: $token)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                } header: {
                    Text("Token de acesso")
                } footer: {
                    Text("É o valor de TREINO_API_TOKEN configurado no site. Fica guardado no Keychain do iPhone.")
                }
                Section {
                    Button {
                        Task { await salvarETestar() }
                    } label: {
                        HStack {
                            Text("Salvar e testar")
                            if testando { Spacer(); ProgressView() }
                        }
                    }
                    .disabled(testando || token.trimmingCharacters(in: .whitespaces).isEmpty)
                    if let resultado {
                        Label(resultado, systemImage: deuCerto ? "checkmark.circle.fill" : "xmark.octagon.fill")
                            .foregroundStyle(deuCerto ? .green : .red)
                            .font(.footnote)
                    }
                }
                Section {
                    Toggle("Enviar corridas ao relógio sozinho", isOn: $envioAutomatico)
                } footer: {
                    Text("Ao abrir o app, as corridas planejadas de hoje em diante que ainda não estão no relógio (ou que mudaram no site) são enviadas. Musculação não entra: você escolhe na hora.")
                }
                Section {
                    Button("Sincronizar só os novos") { saude.iniciar(.novos) }
                        .disabled(saude.rodando || !Servidor.configurado)

                    if !saude.anosDisponiveis.isEmpty {
                        Picker("Ano", selection: $anoEscolhido) {
                            ForEach(saude.anosDisponiveis, id: \.self) { Text(String($0)).tag($0) }
                        }
                        Button("Sincronizar o ano \(String(anoEscolhido))") { saude.iniciar(.ano(anoEscolhido)) }
                            .disabled(saude.rodando || !Servidor.configurado)
                        Button("Sincronizar todo o histórico (\(saude.anosDisponiveis.count) anos)") { confirmandoHistorico = true }
                            .disabled(saude.rodando || !Servidor.configurado)
                    }

                    if saude.rodando {
                        HStack {
                            ProgressView()
                            Text(saude.progresso ?? "Lendo o app Saúde…").font(.footnote).foregroundStyle(.secondary)
                        }
                        Button("Interromper", role: .destructive) { saude.cancelar() }
                    }
                    switch saude.fase {
                    case .parado, .lendo, .enviando: EmptyView()
                    case .concluido(let msg):
                        Label(msg, systemImage: "checkmark.circle.fill").foregroundStyle(.green).font(.footnote)
                    case .erro(let msg):
                        Label(msg, systemImage: "xmark.octagon.fill").foregroundStyle(.red).font(.footnote)
                    }
                } header: {
                    Text("Apple Saúde")
                } footer: {
                    Text("Lê corridas, caminhadas e musculação gravadas pelo Apple Watch (com frequência cardíaca, rota e métricas de corrida) e envia para o site. Reenviar um treino não duplica. O histórico completo pode levar vários minutos: mantenha o app aberto e o iPhone desbloqueado.")
                }
                Section {
                    Button("Remover treinos do relógio", role: .destructive) { confirmandoLimpeza = true }
                    if limpo {
                        Label("Pronto. Abra o app Treino no relógio para conferir.", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                            .font(.footnote)
                    }
                } footer: {
                    Text("Apaga do Apple Watch os treinos que este app agendou, inclusive os de teste antigos.")
                }
            }
            .navigationTitle("Ajustes")
            .navigationBarTitleDisplayMode(.inline)
            .task { await saude.carregarAnos() }
            .confirmationDialog(
                "Enviar todo o histórico do app Saúde?",
                isPresented: $confirmandoHistorico,
                titleVisibility: .visible
            ) {
                Button("Enviar tudo, do ano mais recente ao mais antigo") { saude.iniciar(.tudo) }
                Button("Cancelar", role: .cancel) {}
            } message: {
                Text("Vai ler as corridas, caminhadas e musculações de todos os anos, uma por uma, e pode levar vários minutos. Dá para interromper e retomar: o reenvio não duplica.")
            }
            .confirmationDialog(
                "Remover todos os treinos que este app agendou no relógio?",
                isPresented: $confirmandoLimpeza,
                titleVisibility: .visible
            ) {
                Button("Remover tudo do relógio", role: .destructive) {
                    Task { await aoLimpar(); limpo = true }
                }
                Button("Cancelar", role: .cancel) {}
            } message: {
                Text("Treinos de teste antigos somem junto. Depois é só enviar a semana de novo.")
            }
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Fechar") { dismiss() } }
            }
        }
        .preferredColorScheme(.light)
    }

    private func salvarETestar() async {
        testando = true
        defer { testando = false }
        Servidor.endereco = endereco
        Servidor.token = token
        do {
            let r = try await Servidor.buscarSemana()
            deuCerto = true
            resultado = r.sessoes.isEmpty ? (r.aviso ?? "Conectado, mas sem treinos na semana.") : "Conectado: \(r.sessoes.count) treinos na semana."
            await aoSalvar()
        } catch {
            deuCerto = false
            resultado = error.localizedDescription
        }
    }
}

#Preview {
    ContentView()
}
