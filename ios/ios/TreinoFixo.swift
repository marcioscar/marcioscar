import WorkoutKit
import HealthKit

/// Zonas de ritmo do Marcio (Canova + Daniels) em km/h, as mesmas de app/lib/zonas-pace.ts.
/// O relógio fala/avisa quando o ritmo sai da faixa da etapa.
enum ZonaKmh {
    static let z1 = 8.28...9.23      // Recuperação  07:15–06:30
    static let z2 = 9.23...10.43     // Fácil/Longão 06:30–05:45
    static let z3 = 10.43...11.80    // Maratona     05:45–05:05
    static let z4 = 11.80...12.86    // Limiar       05:05–04:40
    static let z5 = 12.86...14.12    // VO2 máx      04:40–04:15
    static let z6 = 14.12...15.65    // Velocidade   04:15–03:50
}

/// Treino de teste, fixo: 5 min de aquecimento (Z1–Z2), 4 × (400 m em Z5 + 90 s de trote em Z1),
/// 5 min de desaquecimento (Z1–Z2). Depois trocamos por treinos vindos do planejador do site.
enum TreinoFixo {
    static func plano() -> WorkoutPlan {
        // Z1 a Z2 juntas: 8,28 a 10,43 km/h
        let faixaAquecimento = ZonaKmh.z1.lowerBound...ZonaKmh.z2.upperBound

        let aquecimento = WorkoutStep(
            goal: .time(5, .minutes),
            alert: .speed(faixaAquecimento, unit: .kilometersPerHour, metric: .current)
        )

        let tiros = IntervalBlock(
            steps: [
                IntervalStep(
                    .work,
                    goal: .distance(400, .meters),
                    alert: .speed(ZonaKmh.z5, unit: .kilometersPerHour, metric: .current)
                ),
                IntervalStep(
                    .recovery,
                    goal: .time(90, .seconds),
                    alert: .speed(ZonaKmh.z1, unit: .kilometersPerHour, metric: .current)
                ),
            ],
            iterations: 4
        )

        let desaquecimento = WorkoutStep(
            goal: .time(5, .minutes),
            alert: .speed(faixaAquecimento, unit: .kilometersPerHour, metric: .current)
        )

        let treino = CustomWorkout(
            activity: .running,
            location: .outdoor,
            displayName: "Teste: 4×400 m",
            warmup: aquecimento,
            blocks: [tiros],
            cooldown: desaquecimento
        )

        return WorkoutPlan(.custom(treino))
    }
}
