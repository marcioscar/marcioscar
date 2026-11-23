import SwiftUI
import HealthKit
import WorkoutKit

struct ContentView: View {
    @State private var sessoes: [Sessao] = []
    @State private var infoSemana: RespostaSemana?
    @State private var carregando = false
    @State private var erro: String?
    @State private var mostrarAjustes = false
    @State private var selecionadaId: String?
    @State private var agendadas: Set<UUID> = []
    @State private var mensagem: String?
    @State private var enviando = false
    @State private var planoPrevia = WorkoutPlan(.custom(CustomWorkout(activity: .running, location: .outdoor, displayName: "")))
    @State private var mostrarPrevia = false

    private var calendario: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.firstWeekday = 2
        c.locale = Locale(identifier: "pt_BR")
        return c
    }

    private var diasDaSemana: [Date] {
        let inicio = calendario.dateInterval(of: .weekOfYear, for: Date())!.start
        return (0..<7).map { calendario.date(byAdding: .day, value: $0, to: inicio)! }
    }

    private func sessao(em dia: Date) -> Sessao? {
        sessoes.first { calendario.isDate($0.dataComoDate, inSameDayAs: dia) }
    }

    private var selecionada: Sessao? {
        sessoes.first { $0.id == selecionadaId }
    }

    private var diaSelecionado: Date {
        selecionada?.dataComoDate ?? diasDaSemana.first { calendario.isDateInToday($0) } ?? Date()
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    faixaSemana
                    if let erro {
                        Label(erro, systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote)
                            .foregroundStyle(.orange)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
                    } else if sessoes.isEmpty && !carregando {
                        Text(infoSemana?.aviso ?? "Nenhum treino planejado para esta semana.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    detalheDoDia
                    if !sessoes.isEmpty { listaDaSemana }
                    if let mensagem {
                        Text(mensagem)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Treinos da semana")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { mostrarAjustes = true } label: { Image(systemName: "gearshape") }
                        .accessibilityLabel("Ajustes")
                }
            }
            .refreshable { await carregarSemana() }
        }
        .sheet(isPresented: $mostrarAjustes) {
            AjustesView { await carregarSemana() }
        }
        .workoutPreview(planoPrevia, isPresented: $mostrarPrevia)
        .task {
            if !Servidor.configurado { mostrarAjustes = true }
            await carregarSemana()
            await atualizarAgendadas()
        }
    }

    // MARK: calendário

    private var faixaSemana: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(tituloSemana)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            HStack(spacing: 6) {
                ForEach(diasDaSemana, id: \.self) { dia in
                    let s = sessao(em: dia)
                    let escolhido = calendario.isDate(dia, inSameDayAs: diaSelecionado)
                    let hoje = calendario.isDateInToday(dia)
                    Button {
                        if let s { selecionadaId = s.id } else { selecionadaId = nil }
                        mensagem = nil
                    } label: {
                        VStack(spacing: 6) {
                            Text(dia.formatted(.dateTime.weekday(.narrow).locale(Locale(identifier: "pt_BR"))).uppercased())
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(escolhido ? .white.opacity(0.85) : .secondary)
                            Text(dia.formatted(.dateTime.day()))
                                .font(.title3.weight(.semibold))
                                .foregroundStyle(escolhido ? .white : .primary)
                            Circle()
                                .fill(s.map { corPrincipal($0) } ?? .clear)
                                .overlay(Circle().stroke(escolhido ? .white.opacity(0.6) : .clear, lineWidth: 1))
                                .frame(width: 6, height: 6)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(
                            RoundedRectangle(cornerRadius: 14)
                                .fill(escolhido ? Color.accentColor : Color(.secondarySystemGroupedBackground))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 14)
                                .stroke(hoje && !escolhido ? Color.accentColor : .clear, lineWidth: 1.5)
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(dia.formatted(.dateTime.weekday(.wide).day().month(.wide).locale(Locale(identifier: "pt_BR"))) + (s.map { ", " + $0.titulo } ?? ", sem treino"))
                }
            }
        }
    }

    private var tituloSemana: String {
        guard let ini = diasDaSemana.first, let fim = diasDaSemana.last else { return "" }
        let f = Date.FormatStyle().day().month(.wide).locale(Locale(identifier: "pt_BR"))
        return "\(ini.formatted(.dateTime.day())) a \(fim.formatted(f))"
    }

    private func corPrincipal(_ s: Sessao) -> Color {
        let zonas = s.blocos.flatMap(\.etapas).filter { $0.papel == .trabalho }.compactMap(\.zona)
        return (zonas.max { $0.rawValue < $1.rawValue } ?? .z2).cor
    }

    // MARK: detalhe do dia

    @ViewBuilder
    private var detalheDoDia: some View {
        if let s = selecionada {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    Image(systemName: s.tipo.icone)
                        .font(.title2)
                        .foregroundStyle(.white)
                        .frame(width: 48, height: 48)
                        .background(corPrincipal(s).gradient, in: RoundedRectangle(cornerRadius: 12))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(s.titulo).font(.headline)
                        Text("\(s.tipo.rotulo) · \(s.resumo) · \(s.dataComoDate.formatted(.dateTime.weekday(.wide).locale(Locale(identifier: "pt_BR"))))")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                    if agendadas.contains(ConstrutorWorkout.uuid(para: s)) {
                        Label("No relógio", systemImage: "applewatch.watchface")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.green)
                    }
                }

                Divider()

                VStack(alignment: .leading, spacing: 10) {
                    if let a = s.aquecimento { LinhaEtapa(etapa: a) }
                    ForEach(Array(s.blocos.enumerated()), id: \.offset) { _, b in
                        if b.repeticoes > 1 {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("\(b.repeticoes) ×").font(.subheadline.weight(.semibold))
                                ForEach(Array(b.etapas.enumerated()), id: \.offset) { _, e in LinhaEtapa(etapa: e) }
                            }
                            .padding(10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color(.tertiarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 10))
                        } else {
                            ForEach(Array(b.etapas.enumerated()), id: \.offset) { _, e in LinhaEtapa(etapa: e) }
                        }
                    }
                    if let d = s.desaquecimento { LinhaEtapa(etapa: d) }
                }

                HStack(spacing: 10) {
                    Button {
                        planoPrevia = ConstrutorWorkout.plano(para: s)
                        mostrarPrevia = true
                    } label: {
                        Label("Prévia", systemImage: "eye").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)

                    Button {
                        Task { await enviar([s]) }
                    } label: {
                        Label(agendadas.contains(ConstrutorWorkout.uuid(para: s)) ? "Reenviar" : "Enviar para o relógio", systemImage: "applewatch")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(enviando)
                }
                .controlSize(.large)
            }
            .padding(16)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20))
        } else {
            VStack(spacing: 8) {
                Image(systemName: "moon.zzz").font(.largeTitle).foregroundStyle(.secondary)
                Text("Dia de descanso").font(.headline)
                Text("Sem treino planejado para este dia.").font(.subheadline).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(28)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20))
        }
    }

    // MARK: lista da semana

    private var listaDaSemana: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Semana").font(.title3.bold())
                Spacer()
                Button {
                    Task { await enviar(sessoes) }
                } label: {
                    Label("Enviar semana", systemImage: "applewatch")
                }
                .buttonStyle(.bordered)
                .disabled(enviando)
            }
            VStack(spacing: 0) {
                ForEach(Array(sessoes.enumerated()), id: \.element.id) { i, s in
                    Button {
                        selecionadaId = s.id
                        mensagem = nil
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: s.tipo.icone)
                                .foregroundStyle(corPrincipal(s))
                                .frame(width: 26)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(s.titulo).font(.subheadline.weight(.medium)).foregroundStyle(.primary)
                                Text("\(s.dataComoDate.formatted(.dateTime.weekday(.wide).day().month(.abbreviated).locale(Locale(identifier: "pt_BR")))) · \(s.resumo)")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            if agendadas.contains(ConstrutorWorkout.uuid(para: s)) {
                                Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
                            }
                            Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
                        }
                        .padding(.vertical, 12)
                        .padding(.horizontal, 14)
                    }
                    .buttonStyle(.plain)
                    if i < sessoes.count - 1 { Divider().padding(.leading, 52) }
                }
            }
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
        }
    }

    // MARK: dados do site

    private func carregarSemana() async {
        carregando = true
        defer { carregando = false }
        do {
            let r = try await Servidor.buscarSemana()
            infoSemana = r
            sessoes = r.sessoes.sorted { $0.data < $1.data }
            erro = nil
            let hoje = Calendar.current.startOfDay(for: Date())
            if selecionada == nil {
                selecionadaId = (sessao(em: Date()) ?? sessoes.first { $0.dataComoDate >= hoje } ?? sessoes.first)?.id
            }
        } catch {
            erro = error.localizedDescription
        }
    }

    // MARK: envio

    private func atualizarAgendadas() async {
        guard WorkoutScheduler.isSupported else { return }
        let lista = await WorkoutScheduler.shared.scheduledWorkouts
        agendadas = Set(lista.map(\.plan.id))
    }

    private func enviar(_ todas: [Sessao]) async {
        // dias que já passaram não entram (o relógio não agenda no passado)
        let hoje = Calendar.current.startOfDay(for: Date())
        let lista = todas.filter { $0.dataComoDate >= hoje }
        guard !lista.isEmpty else {
            mensagem = "Esses treinos já passaram."
            return
        }
        enviando = true
        defer { enviando = false }

        let estado = await WorkoutScheduler.shared.requestAuthorization()
        guard estado == .authorized else {
            mensagem = "Sem permissão para agendar treinos. Libere em Ajustes > Saúde > Acesso a dados e dispositivos."
            return
        }

        // remove versões antigas dessas sessões (mesmo id) antes de agendar de novo
        let existentes = await WorkoutScheduler.shared.scheduledWorkouts
        let ids = Set(lista.map(ConstrutorWorkout.uuid(para:)))
        for e in existentes where ids.contains(e.plan.id) {
            await WorkoutScheduler.shared.remove(e.plan, at: e.date)
        }

        for s in lista {
            await WorkoutScheduler.shared.schedule(ConstrutorWorkout.plano(para: s), at: ConstrutorWorkout.componentes(para: s))
        }
        await atualizarAgendadas()
        mensagem = lista.count == 1
            ? "“\(lista[0].titulo)” enviado. Abra o app Treino no Apple Watch."
            : "\(lista.count) treinos enviados para o relógio."
    }
}

struct LinhaEtapa: View {
    let etapa: Etapa

    var body: some View {
        HStack(spacing: 10) {
            RoundedRectangle(cornerRadius: 2)
                .fill(etapa.zona?.cor ?? .gray)
                .frame(width: 4, height: 34)
            VStack(alignment: .leading, spacing: 1) {
                Text(etapa.papel.rotulo).font(.subheadline.weight(.medium))
                Text(etapa.descricaoMeta).font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            if let z = etapa.zona {
                VStack(alignment: .trailing, spacing: 1) {
                    Text("Z\(z.rawValue) · \(z.nome)")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(z.cor)
                    if let p = etapa.textoPace {
                        Text("\(p) /km").font(.caption2).foregroundStyle(.secondary).monospacedDigit()
                    }
                }
            }
        }
    }
}

#Preview {
    ContentView()
}


struct AjustesView: View {
    @Environment(\.dismiss) private var dismiss
    var aoSalvar: () async -> Void

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
            }
            .navigationTitle("Ajustes")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Fechar") { dismiss() } }
            }
        }
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
