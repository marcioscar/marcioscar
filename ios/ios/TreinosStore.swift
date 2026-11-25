import CryptoKit
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

    /// Todas as sessões de um dia (corrida e musculação podem coexistir)
    func sessoes(em dia: Date) -> [Sessao] {
        sessoes.filter { calendario.isDate($0.dataComoDate, inSameDayAs: dia) }
    }

    var sessoesHoje: [Sessao] { sessoes(em: Date()) }

    /// Sessões da semana depois de hoje (para "Resto da semana").
    var restoDaSemana: [Sessao] {
        let hoje = calendario.startOfDay(for: Date())
        return sessoes.filter { $0.dataComoDate > hoje }
    }

    var kmDaSemana: Double { sessoes.filter { !$0.ehMusculacao }.reduce(0) { $0 + $1.distanciaKm } }

    func estaNoRelogio(_ s: Sessao) -> Bool { agendadas.contains(ConstrutorWorkout.uuid(para: s)) }

    func carregar() async {
        carregando = true
        defer { carregando = false }
        do {
            let r = try await Servidor.buscarSemana()
            info = r
            TabelaZonas.atualizar(r.zonas)
            sessoes = r.sessoes.sorted { $0.data < $1.data }
            erro = nil
        } catch {
            erro = error.localizedDescription
        }
        await atualizarAgendadas()
        await enviarCorridasAutomaticamente()
    }

    // MARK: envio automático das corridas

    private static let chaveAuto = "autoEnvioRelogio"

    /// "Enviar sozinho para o relógio" (ligado por padrão; dá para desligar em Ajustes).
    static var envioAutomaticoLigado: Bool {
        get { UserDefaults.standard.object(forKey: chaveAuto) as? Bool ?? true }
        set { UserDefaults.standard.set(newValue, forKey: chaveAuto) }
    }

    /// Assinatura do conteúdo enviado por sessão: se o plano muda no site, a assinatura muda e o treino é reenviado.
    private func assinatura(_ s: Sessao) -> String {
        var dados = (try? JSONEncoder().encode(s)) ?? Data()
        // o alvo do marcador entra na assinatura: mudar a regra do alvo reenvia o treino
        if let m = ConstrutorWorkout.marcador(para: s) { dados.append(Data("marcador-\(Int(m.distanciaM))-\(Int(m.tempoSeg))".utf8)) }
        return Insecure.MD5.hash(data: dados).map { String(format: "%02x", $0) }.joined()
    }

    private var enviadas: [String: String] {
        get { UserDefaults.standard.dictionary(forKey: "assinaturasEnviadas") as? [String: String] ?? [:] }
        set { UserDefaults.standard.set(newValue, forKey: "assinaturasEnviadas") }
    }

    /// Manda ao relógio as corridas de hoje em diante que ainda não estão lá (ou que mudaram no site).
    /// Musculação fica de fora: você escolhe o treino na hora. Não pede permissão sozinho.
    func enviarCorridasAutomaticamente() async {
        guard Self.envioAutomaticoLigado, WorkoutScheduler.isSupported else { return }
        guard await WorkoutScheduler.shared.authorizationState == .authorized else { return }

        let hoje = calendario.startOfDay(for: Date())
        var registro = enviadas
        let pendentes = sessoes.filter { s in
            guard !s.ehMusculacao, s.dataComoDate >= hoje else { return false }
            return !estaNoRelogio(s) || registro[s.id] != assinatura(s)
        }
        guard !pendentes.isEmpty else { return }

        let existentes = await WorkoutScheduler.shared.scheduledWorkouts
        let ids = Set(pendentes.map(ConstrutorWorkout.uuid(para:)))
        for e in existentes where ids.contains(e.plan.id) {
            await WorkoutScheduler.shared.remove(e.plan, at: e.date)
        }
        for s in pendentes {
            await WorkoutScheduler.shared.schedule(ConstrutorWorkout.plano(para: s), at: ConstrutorWorkout.componentes(para: s))
            registro[s.id] = assinatura(s)
        }
        enviadas = registro
        await atualizarAgendadas()
        mensagem = pendentes.count == 1
            ? "“\(pendentes[0].titulo)” enviado automaticamente ao relógio."
            : "\(pendentes.count) corridas enviadas automaticamente ao relógio."
    }

    func atualizarAgendadas() async {
        guard WorkoutScheduler.isSupported else { return }
        let lista = await WorkoutScheduler.shared.scheduledWorkouts
        agendadas = Set(lista.map(\.plan.id))
    }

    /// Apaga do relógio tudo o que este app agendou (inclui treinos de teste antigos).
    func limparRelogio() async {
        guard WorkoutScheduler.isSupported else { return }
        let estado = await WorkoutScheduler.shared.requestAuthorization()
        guard estado == .authorized else {
            mensagem = "Sem permissão para mexer nos treinos do relógio."
            return
        }
        let antes = await WorkoutScheduler.shared.scheduledWorkouts.count
        await WorkoutScheduler.shared.removeAllWorkouts()
        await atualizarAgendadas()
        mensagem = antes == 0 ? "Não havia treinos agendados." : "\(antes) treino(s) removido(s) do relógio."
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
        var registro = enviadas
        for s in lista {
            await WorkoutScheduler.shared.schedule(ConstrutorWorkout.plano(para: s), at: ConstrutorWorkout.componentes(para: s))
            registro[s.id] = assinatura(s)
        }
        enviadas = registro
        await atualizarAgendadas()
        mensagem = lista.count == 1
            ? "“\(lista[0].titulo)” enviado. Abra o app Treino no Apple Watch."
            : "\(lista.count) treinos enviados para o relógio."
    }
}
