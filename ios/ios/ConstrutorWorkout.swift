import CryptoKit
import Foundation
import HealthKit
import WorkoutKit

/// Converte uma `Sessao` em plano do WorkoutKit, com alerta de pace (faixa da zona) em cada etapa.
enum ConstrutorWorkout {
    /// Id estável por sessão: reenviar a mesma sessão substitui em vez de duplicar.
    static func uuid(para sessao: Sessao) -> UUID {
        let hash = Insecure.MD5.hash(data: Data(sessao.id.utf8))
        let b = Array(hash)
        return UUID(uuid: (b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9], b[10], b[11], b[12], b[13], b[14], b[15]))
    }

    private static func meta(_ e: Etapa) -> WorkoutGoal {
        if let d = e.distanciaM { return .distance(d, .meters) }
        if let t = e.tempoSeg { return .time(t, .seconds) }
        return .open
    }

    private static func alerta(_ e: Etapa) -> (any WorkoutAlert)? {
        guard let faixa = e.faixaKmh else { return nil }
        return SpeedRangeAlert(
            target: Measurement(value: faixa.lowerBound, unit: UnitSpeed.kilometersPerHour)
                ...
                Measurement(value: faixa.upperBound, unit: UnitSpeed.kilometersPerHour),
            metric: .current
        )
    }

    private static func passo(_ e: Etapa) -> WorkoutStep {
        // o nome da etapa (ex.: o exercício) só existe no iOS 18 ou mais
        if #available(iOS 18.0, *), let nome = e.nome, !nome.isEmpty {
            return WorkoutStep(goal: meta(e), alert: alerta(e), displayName: nome)
        }
        return WorkoutStep(goal: meta(e), alert: alerta(e))
    }

    /// "Marcador de ritmo" do relógio (ligado por padrão; dá para desligar em Ajustes).
    static var marcadorDeRitmoLigado: Bool {
        UserDefaults.standard.object(forKey: "marcadorDeRitmo") as? Bool ?? true
    }

    /// Corrida contínua (uma etapa só, com distância e pace, sem aquecimento nem desaquecimento) vira marcador de ritmo:
    /// distância e tempo alvo, e o relógio mostra a barra de quanto você está adiantado ou atrasado.
    static func marcador(para sessao: Sessao) -> (distanciaM: Double, tempoSeg: Double)? {
        guard marcadorDeRitmoLigado, !sessao.ehMusculacao,
              sessao.aquecimento == nil, sessao.desaquecimento == nil,
              sessao.blocos.count == 1, let bloco = sessao.blocos.first, bloco.repeticoes == 1, bloco.etapas.count == 1,
              let e = bloco.etapas.first, e.papel == .trabalho,
              let d = e.distanciaM, d >= 1000,
              let faixa = e.faixaKmh else { return nil }
        let kmhMedio = (faixa.lowerBound + faixa.upperBound) / 2
        guard kmhMedio > 3 else { return nil }
        return (d, d / (kmhMedio / 3.6))
    }

    static func plano(para sessao: Sessao) -> WorkoutPlan {
        if let m = marcador(para: sessao) {
            let pacer = PacerWorkout(
                activity: .running,
                location: .outdoor,
                distance: Measurement(value: m.distanciaM, unit: UnitLength.meters),
                time: Measurement(value: m.tempoSeg, unit: UnitDuration.seconds)
            )
            return WorkoutPlan(.pacer(pacer), id: uuid(para: sessao))
        }
        let blocos = sessao.blocos.map { bloco in
            IntervalBlock(
                steps: bloco.etapas.map { e in
                    IntervalStep(e.papel == .recuperacao ? .recovery : .work, step: passo(e))
                },
                iterations: bloco.repeticoes
            )
        }
        let treino = CustomWorkout(
            activity: sessao.ehMusculacao ? .traditionalStrengthTraining : .running,
            location: sessao.ehMusculacao ? .indoor : .outdoor,
            displayName: sessao.titulo,
            warmup: sessao.aquecimento.map(passo),
            blocks: blocos,
            cooldown: sessao.desaquecimento.map(passo)
        )
        return WorkoutPlan(.custom(treino), id: uuid(para: sessao))
    }

    /// Agenda no dia da sessão: corrida às 06:00, musculação às 18:00 (hoje, se a hora já passou, vira daqui a 1 minuto).
    static func componentes(para sessao: Sessao) -> DateComponents {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .current
        var data = cal.date(bySettingHour: sessao.ehMusculacao ? 18 : 6, minute: 0, second: 0, of: sessao.dataComoDate) ?? Date()
        if data < Date() {
            data = cal.isDateInToday(sessao.dataComoDate) ? Date().addingTimeInterval(60) : data
        }
        return cal.dateComponents([.year, .month, .day, .hour, .minute], from: data)
    }
}
