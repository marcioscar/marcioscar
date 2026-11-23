import SwiftUI
import HealthKit
import WorkoutKit

struct ContentView: View {
    @State private var sessoes = SemanaExemplo.sessoes()
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
                    detalheDoDia
                    listaDaSemana
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
        }
        .workoutPreview(planoPrevia, isPresented: $mostrarPrevia)
        .task {
            if selecionadaId == nil {
                selecionadaId = (sessao(em: Date()) ?? sessoes.first { $0.dataComoDate >= Calendar.current.startOfDay(for: Date()) } ?? sessoes.first)?.id
            }
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

    // MARK: envio

    private func atualizarAgendadas() async {
        guard WorkoutScheduler.isSupported else { return }
        let lista = await WorkoutScheduler.shared.scheduledWorkouts
        agendadas = Set(lista.map(\.plan.id))
    }

    private func enviar(_ lista: [Sessao]) async {
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
                    Text("\(z.pace) /km").font(.caption2).foregroundStyle(.secondary).monospacedDigit()
                }
            }
        }
    }
}

#Preview {
    ContentView()
}
