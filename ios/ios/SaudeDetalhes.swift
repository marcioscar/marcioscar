import Foundation
import HealthKit

// Splits por km e voltas calculados a partir das amostras do app Saúde (distância e frequência
// cardíaca com horário) e dos eventos do treino (voltas, segmentos, pausas).

struct SplitPayload: Codable {
    var km: Int
    var distanciaM: Double
    var tempoSeg: Double
    var fcMedia: Double?
}

struct VoltaPayload: Codable {
    var indice: Int
    /// "etapa" (atividade do HKWorkout, ex.: etapas de um treino estruturado), "segmento" ou "volta"
    var tipo: String
    /// Nome da etapa quando o relógio grava um (ex.: "Z5", "Descanso")
    var rotulo: String?
    /// Metadados crus da atividade, para conferência
    var metadados: [String: String]?
    var inicio: Date
    var fim: Date
    var distanciaM: Double
    var tempoSeg: Double
    var fcMedia: Double?
    /// Métricas de corrida medidas pelo relógio só nesta etapa
    var potenciaW: Double?
    var cadencia: Double?
    var passadaM: Double?
    var oscilacaoCm: Double?
    var contatoMs: Double?
}

struct EventoPayload: Codable {
    var tipo: String
    var inicio: Date
    var fim: Date
}

struct AmostraDistancia {
    var inicio: Date
    var fim: Date
    var metros: Double
}

struct AmostraFC {
    var data: Date
    var bpm: Double
}

enum DetalhesTreino {
    static func nome(_ t: HKWorkoutEventType) -> String {
        switch t {
        case .pause: "pause"
        case .resume: "resume"
        case .lap: "lap"
        case .marker: "marker"
        case .motionPaused: "motionPaused"
        case .motionResumed: "motionResumed"
        case .segment: "segment"
        case .pauseOrResumeRequest: "pauseOrResumeRequest"
        @unknown default: "other(\(t.rawValue))"
        }
    }

    static func eventos(_ w: HKWorkout) -> [EventoPayload] {
        (w.workoutEvents ?? []).prefix(300).map {
            EventoPayload(tipo: nome($0.type), inicio: $0.dateInterval.start, fim: $0.dateInterval.end)
        }
    }

    /// Trechos em que o treino esteve pausado (pause → resume), para tirar do tempo em movimento.
    static func pausas(_ eventos: [EventoPayload]) -> [DateInterval] {
        var r: [DateInterval] = []
        var abertura: Date?
        for e in eventos.sorted(by: { $0.inicio < $1.inicio }) {
            switch e.tipo {
            case "pause", "motionPaused":
                if abertura == nil { abertura = e.inicio }
            case "resume", "motionResumed":
                if let a = abertura, e.inicio > a { r.append(DateInterval(start: a, end: e.inicio)) }
                abertura = nil
            default: break
            }
        }
        return r
    }

    static func segundosEmMovimento(de a: Date, ate b: Date, pausas: [DateInterval]) -> Double {
        guard b > a else { return 0 }
        var total = b.timeIntervalSince(a)
        for p in pausas {
            let ini = max(p.start, a), fim = min(p.end, b)
            if fim > ini { total -= fim.timeIntervalSince(ini) }
        }
        return max(total, 0)
    }

    /// Metros percorridos entre duas datas, repartindo cada amostra proporcionalmente ao tempo.
    static func metros(entre a: Date, e b: Date, amostras: [AmostraDistancia]) -> Double {
        var soma = 0.0
        for s in amostras {
            let dur = s.fim.timeIntervalSince(s.inicio)
            let ini = max(s.inicio, a), fim = min(s.fim, b)
            if fim <= ini { continue }
            soma += dur > 0 ? s.metros * fim.timeIntervalSince(ini) / dur : s.metros
        }
        return soma
    }

    static func fcMedia(entre a: Date, e b: Date, fc: [AmostraFC]) -> Double? {
        let dentro = fc.filter { $0.data >= a && $0.data <= b }
        guard !dentro.isEmpty else { return nil }
        return dentro.reduce(0) { $0 + $1.bpm } / Double(dentro.count)
    }

    /// Um split por km completo (e o trecho final), com o horário de cada marco de 1.000 m.
    static func splits(amostras: [AmostraDistancia], fc: [AmostraFC], pausas: [DateInterval]) -> [SplitPayload] {
        let ordenadas = amostras.sorted { $0.inicio < $1.inicio }
        guard let primeira = ordenadas.first, let ultima = ordenadas.last else { return [] }

        var marcos: [Date] = [primeira.inicio]
        var acumulado = 0.0
        var proximo = 1000.0
        for s in ordenadas {
            let dur = s.fim.timeIntervalSince(s.inicio)
            var restante = s.metros
            while acumulado + restante >= proximo, s.metros > 0 {
                let faltam = proximo - acumulado
                marcos.append(s.inicio.addingTimeInterval(dur * ((s.metros - restante) + faltam) / s.metros))
                restante -= faltam
                acumulado = proximo
                proximo += 1000
            }
            acumulado += restante
        }
        marcos.append(ultima.fim)

        var r: [SplitPayload] = []
        for i in 0..<(marcos.count - 1) {
            let a = marcos[i], b = marcos[i + 1]
            let m = metros(entre: a, e: b, amostras: ordenadas)
            guard m >= 50 else { continue } // descarta sobra minúscula no fim
            r.append(SplitPayload(
                km: i + 1,
                distanciaM: m,
                tempoSeg: segundosEmMovimento(de: a, ate: b, pausas: pausas),
                fcMedia: fcMedia(entre: a, e: b, fc: fc)
            ))
        }
        return r
    }

    /// Etapas de treino estruturado: cada HKWorkoutActivity é um trecho (aquecimento, tiro, descanso...).
    static func voltasDeAtividades(_ w: HKWorkout, amostras: [AmostraDistancia], fc: [AmostraFC]) -> [VoltaPayload] {
        let atividades = w.workoutActivities.sorted { $0.startDate < $1.startDate }
        guard atividades.count > 1 else { return [] }

        return atividades.enumerated().map { i, a in
            let fim = a.endDate ?? w.endDate
            let meta = (a.metadata ?? [:]).reduce(into: [String: String]()) { r, kv in
                let valor = (kv.value as? HKQuantity)?.description ?? "\(kv.value)"
                r[String(kv.key.prefix(60))] = String(valor.prefix(80))
            }
            func media(_ id: HKQuantityTypeIdentifier, _ u: HKUnit) -> Double? {
                a.statistics(for: HKQuantityType(id))?.averageQuantity()?.doubleValue(for: u)
            }
            let passos = a.statistics(for: HKQuantityType(.stepCount))?.sumQuantity()?.doubleValue(for: .count())
            return VoltaPayload(
                indice: i + 1,
                tipo: "etapa",
                rotulo: rotulo(de: meta),
                metadados: meta.isEmpty ? nil : meta,
                inicio: a.startDate,
                fim: fim,
                distanciaM: metros(entre: a.startDate, e: fim, amostras: amostras),
                tempoSeg: a.duration,
                fcMedia: fcMedia(entre: a.startDate, e: fim, fc: fc),
                potenciaW: media(.runningPower, .watt()),
                cadencia: passos.flatMap { a.duration > 0 ? $0 / (a.duration / 60) : nil },
                passadaM: media(.runningStrideLength, .meter()),
                oscilacaoCm: media(.runningVerticalOscillation, .meterUnit(with: .centi)),
                contatoMs: media(.runningGroundContactTime, .secondUnit(with: .milli))
            )
        }
    }

    /// Escolhe do metadado um nome curto para a etapa (chave com name/title/label/step/zone).
    static func rotulo(de meta: [String: String]) -> String? {
        let prioridade = ["name", "title", "label", "step", "zone", "purpose"]
        for chave in prioridade {
            if let kv = meta.first(where: { $0.key.lowercased().contains(chave) }), kv.value.count <= 30 {
                return kv.value
            }
        }
        return nil
    }

    /// Voltas: segmentos (com início e fim) ou, se houver só marcas de volta, os trechos entre elas.
    static func voltas(eventos: [EventoPayload], inicio: Date, fim: Date, amostras: [AmostraDistancia], fc: [AmostraFC], pausas: [DateInterval]) -> [VoltaPayload] {
        var trechos: [(String, Date, Date)] = []

        let segmentos = eventos.filter { $0.tipo == "segment" && $0.fim > $0.inicio }.sorted { $0.inicio < $1.inicio }
        if !segmentos.isEmpty {
            trechos = segmentos.map { ("segmento", $0.inicio, $0.fim) }
        } else {
            let marcas = eventos.filter { $0.tipo == "lap" || $0.tipo == "marker" }.map(\.inicio).sorted()
            if !marcas.isEmpty {
                let limites = [inicio] + marcas + [fim]
                for i in 0..<(limites.count - 1) where limites[i + 1] > limites[i] {
                    trechos.append(("volta", limites[i], limites[i + 1]))
                }
            }
        }

        return trechos.enumerated().map { i, t in
            VoltaPayload(
                indice: i + 1,
                tipo: t.0,
                rotulo: nil,
                metadados: nil,
                inicio: t.1,
                fim: t.2,
                distanciaM: metros(entre: t.1, e: t.2, amostras: amostras),
                tempoSeg: segundosEmMovimento(de: t.1, ate: t.2, pausas: pausas),
                fcMedia: fcMedia(entre: t.1, e: t.2, fc: fc),
                potenciaW: nil, cadencia: nil, passadaM: nil, oscilacaoCm: nil, contatoMs: nil
            )
        }
    }
}
