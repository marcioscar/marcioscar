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
        guard let z = e.zona else { return nil }
        return SpeedRangeAlert(
            target: Measurement(value: z.kmh.lowerBound, unit: UnitSpeed.kilometersPerHour)
                ...
                Measurement(value: z.kmh.upperBound, unit: UnitSpeed.kilometersPerHour),
            metric: .current
        )
    }

    private static func passo(_ e: Etapa) -> WorkoutStep {
        WorkoutStep(goal: meta(e), alert: alerta(e))
    }

    static func plano(para sessao: Sessao) -> WorkoutPlan {
        let blocos = sessao.blocos.map { bloco in
            IntervalBlock(
                steps: bloco.etapas.map { e in
                    IntervalStep(e.papel == .recuperacao ? .recovery : .work, step: passo(e))
                },
                iterations: bloco.repeticoes
            )
        }
        let treino = CustomWorkout(
            activity: .running,
            location: .outdoor,
            displayName: sessao.titulo,
            warmup: sessao.aquecimento.map(passo),
            blocks: blocos,
            cooldown: sessao.desaquecimento.map(passo)
        )
        return WorkoutPlan(.custom(treino), id: uuid(para: sessao))
    }

    /// Agenda hoje/dia da sessão às 06:00 (passado vira daqui a 1 minuto, para poder testar).
    static func componentes(para sessao: Sessao) -> DateComponents {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .current
        var data = cal.date(bySettingHour: 6, minute: 0, second: 0, of: sessao.dataComoDate) ?? Date()
        if data < Date() {
            data = cal.isDateInToday(sessao.dataComoDate) ? Date().addingTimeInterval(60) : data
        }
        return cal.dateComponents([.year, .month, .day, .hour, .minute], from: data)
    }
}
