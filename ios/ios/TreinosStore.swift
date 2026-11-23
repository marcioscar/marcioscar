import HealthKit
import SwiftUI
import WorkoutKit

@Observable
@MainActor
final class TreinosStore {
    var sessoes: [Sessao] = []
    var info: RespostaSemana?
    var agendadas: Set<UUID> = []
    var carregando = false
    var enviando = false
    var erro: String?
    var mensagem: String?

    var calendario: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.firstWeekday = 2
        c.locale = Locale(identifier: "pt_BR")
        return c
    }

    var diasDaSemana: [Date] {
        let inicio = calendario.dateInterval(of: .weekOfYear, for: Date())!.start
        return (0..<7).map { calendario.date(byAdding: .day, value: $0, to: inicio)! }
    }

    func sessao(em dia: Date) -> Sessao? {
        sessoes.first { calendario.isDate($0.dataComoDate, inSameDayAs: dia) }
    }

    var sessaoHoje: Sessao? { sessao(em: Date()) }

    /// Sessões da semana depois de hoje (para "Resto da semana").
    var restoDaSemana: [Sessao] {
        let hoje = calendario.startOfDay(for: Date())
        return sessoes.filter { $0.dataComoDate > hoje }
    }

    var kmDaSemana: Double { sessoes.reduce(0) { $0 + $1.distanciaKm } }

    func estaNoRelogio(_ s: Sessao) -> Bool { agendadas.contains(ConstrutorWorkout.uuid(para: s)) }

    func carregar() async {
        carregando = true
        defer { carregando = false }
        do {
            let r = try await Servidor.buscarSemana()
            info = r
            sessoes = r.sessoes.sorted { $0.data < $1.data }
            erro = nil
        } catch {
            erro = error.localizedDescription
        }
        await atualizarAgendadas()
    }

    func atualizarAgendadas() async {
        guard WorkoutScheduler.isSupported else { return }
        let lista = await WorkoutScheduler.shared.scheduledWorkouts
        agendadas = Set(lista.map(\.plan.id))
    }

    func enviar(_ todas: [Sessao]) async {
        // dias que já passaram não entram (o relógio não agenda no passado)
        let hoje = calendario.startOfDay(for: Date())
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
