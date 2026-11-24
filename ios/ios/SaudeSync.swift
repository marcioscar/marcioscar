import CoreLocation
import Foundation
import HealthKit

/// Lê os treinos do app Saúde (gravados pelo Apple Watch) e envia para o site.
@Observable
@MainActor
final class SaudeSync {
    enum Fase: Equatable {
        case parado
        case lendo
        case enviando(Int, Int)
        case concluido(String)
        case erro(String)
    }

    var fase: Fase = .parado
    var rodando: Bool {
        switch fase {
        case .lendo, .enviando: true
        default: false
        }
    }

    private let store = HKHealthStore()
    private let tamanhoLote = 8

    // MARK: tipos lidos

    private var tiposLeitura: Set<HKObjectType> {
        var t: Set<HKObjectType> = [HKObjectType.workoutType(), HKSeriesType.workoutRoute()]
        let ids: [HKQuantityTypeIdentifier] = [
            .heartRate, .distanceWalkingRunning, .activeEnergyBurned, .stepCount,
            .runningPower, .runningStrideLength, .runningVerticalOscillation, .runningGroundContactTime,
        ]
        for id in ids { t.insert(HKQuantityType(id)) }
        return t
    }

    // MARK: fluxo principal

    /// Sincroniza. `desdeAnoInteiro` lê desde 1º de janeiro; senão, só o que for mais novo que o site já tem.
    func sincronizar(desdeAnoInteiro: Bool) async {
        guard HKHealthStore.isHealthDataAvailable() else {
            fase = .erro("O app Saúde não está disponível neste aparelho.")
            return
        }
        fase = .lendo
        do {
            try await store.requestAuthorization(toShare: [], read: tiposLeitura)

            let inicio = try await dataInicial(anoInteiro: desdeAnoInteiro)
            let treinos = try await lerTreinos(desde: inicio)
            if treinos.isEmpty {
                fase = .concluido("Nenhum treino novo no Saúde.")
                return
            }

            var enviados = 0
            var criados = 0
            var atualizados = 0
            for lote in treinos.chunked(tamanhoLote) {
                fase = .enviando(enviados, treinos.count)
                let r = try await Servidor.enviarTreinosSaude(lote)
                criados += r.criados
                atualizados += r.atualizados
                enviados += lote.count
            }
            fase = .concluido("\(treinos.count) treinos lidos: \(criados) novos, \(atualizados) atualizados.")
        } catch {
            fase = .erro(error.localizedDescription)
        }
    }

    private func dataInicial(anoInteiro: Bool) async throws -> Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .current
        let primeiroDoAno = cal.date(from: DateComponents(year: cal.component(.year, from: Date()), month: 1, day: 1))!
        if anoInteiro { return primeiroDoAno }
        // incremental: do mais recente que o site tem, menos 2 dias de folga
        if let recente = try await Servidor.maisRecenteSaude() {
            return max(recente.addingTimeInterval(-2 * 86400), primeiroDoAno)
        }
        return primeiroDoAno
    }

    // MARK: leitura

    private func lerTreinos(desde: Date) async throws -> [TreinoSaudePayload] {
        let predicado = HKQuery.predicateForSamples(withStart: desde, end: nil)
        let descritor = HKSampleQueryDescriptor(
            predicates: [.workout(predicado)],
            sortDescriptors: [SortDescriptor(\.startDate, order: .forward)]
        )
        let workouts = try await descritor.result(for: store)

        var saida: [TreinoSaudePayload] = []
        for w in workouts {
            saida.append(await montar(w))
        }
        return saida
    }

    private func montar(_ w: HKWorkout) async -> TreinoSaudePayload {
        let (tipo, nomeHK) = classificar(w.workoutActivityType)

        func media(_ id: HKQuantityTypeIdentifier, _ unidade: HKUnit) -> Double? {
            w.statistics(for: HKQuantityType(id))?.averageQuantity()?.doubleValue(for: unidade)
        }
        func soma(_ id: HKQuantityTypeIdentifier, _ unidade: HKUnit) -> Double? {
            w.statistics(for: HKQuantityType(id))?.sumQuantity()?.doubleValue(for: unidade)
        }

        let bpm = HKUnit.count().unitDivided(by: .minute())
        let passos = soma(.stepCount, .count())
        let elevacao = (w.metadata?[HKMetadataKeyElevationAscended] as? HKQuantity)?.doubleValue(for: .meter())

        let amostrasFCRota = tipo == .musculacao ? [] : await amostrasDeFC(w)
        let rotaCompleta = tipo == .musculacao ? nil : await rotaDoTreino(w, fc: amostrasFCRota)

        // detalhes: splits por km, voltas e eventos (só para corrida e caminhada)
        var splits: [SplitPayload]?
        var voltas: [VoltaPayload]?
        var eventos: [EventoPayload]?
        if tipo == .corrida || tipo == .caminhada {
            let ev = DetalhesTreino.eventos(w)
            let pausas = DetalhesTreino.pausas(ev)
            let amostrasDist = await amostrasDeDistancia(w)
            let amostrasFC = amostrasFCRota
            eventos = ev
            if !amostrasDist.isEmpty {
                splits = DetalhesTreino.splits(amostras: amostrasDist, fc: amostrasFC, pausas: pausas)
                // etapas gravadas pelo relógio (treino estruturado) têm prioridade; senão, segmentos/voltas dos eventos
                var vs = DetalhesTreino.voltasDeAtividades(w, amostras: amostrasDist, fc: amostrasFC)
                if vs.isEmpty {
                    vs = DetalhesTreino.voltas(eventos: ev, inicio: w.startDate, fim: w.endDate, amostras: amostrasDist, fc: amostrasFC, pausas: pausas)
                }
                voltas = vs.isEmpty ? nil : vs
            }
        }

        return TreinoSaudePayload(
            healthId: w.uuid.uuidString,
            tipo: tipo.rawValue,
            tipoHealthKit: nomeHK,
            inicio: w.startDate,
            fim: w.endDate,
            duracaoSeg: w.duration,
            distanciaM: soma(.distanceWalkingRunning, .meter()),
            caloriasKcal: soma(.activeEnergyBurned, .kilocalorie()),
            fcMedia: media(.heartRate, bpm),
            fcMaxima: w.statistics(for: HKQuantityType(.heartRate))?.maximumQuantity()?.doubleValue(for: bpm),
            cadenciaMedia: passos.flatMap { w.duration > 0 ? $0 / (w.duration / 60) : nil },
            potenciaMediaW: media(.runningPower, .watt()),
            passadaM: media(.runningStrideLength, .meter()),
            oscilacaoVerticalCm: media(.runningVerticalOscillation, .meterUnit(with: .centi)),
            contatoSoloMs: media(.runningGroundContactTime, .secondUnit(with: .milli)),
            elevacaoGanhoM: elevacao,
            polyline: rotaCompleta?.polyline,
            rota: rotaCompleta?.vetores,
            splits: splits,
            voltas: voltas,
            eventos: eventos
        )
    }

    /// Amostras do próprio treino; se a associação não trouxer nada, cai para a janela de tempo da mesma fonte.
    private func amostras(_ id: HKQuantityTypeIdentifier, _ w: HKWorkout) async -> [HKQuantitySample] {
        let tipo = HKQuantityType(id)
        let associado = HKSampleQueryDescriptor(
            predicates: [.quantitySample(type: tipo, predicate: HKQuery.predicateForObjects(from: w))],
            sortDescriptors: [SortDescriptor(\.startDate, order: .forward)]
        )
        if let r = try? await associado.result(for: store), !r.isEmpty { return r }

        let janela = HKQuery.predicateForSamples(withStart: w.startDate, end: w.endDate)
        let fonte = HKQuery.predicateForObjects(from: [w.sourceRevision.source])
        let combinado = NSCompoundPredicate(andPredicateWithSubpredicates: [janela, fonte])
        let alternativa = HKSampleQueryDescriptor(
            predicates: [.quantitySample(type: tipo, predicate: combinado)],
            sortDescriptors: [SortDescriptor(\.startDate, order: .forward)]
        )
        return (try? await alternativa.result(for: store)) ?? []
    }

    private func amostrasDeDistancia(_ w: HKWorkout) async -> [AmostraDistancia] {
        await amostras(.distanceWalkingRunning, w).map {
            AmostraDistancia(inicio: $0.startDate, fim: $0.endDate, metros: $0.quantity.doubleValue(for: .meter()))
        }
    }

    private func amostrasDeFC(_ w: HKWorkout) async -> [AmostraFC] {
        let bpm = HKUnit.count().unitDivided(by: .minute())
        return await amostras(.heartRate, w).map {
            AmostraFC(data: $0.startDate, bpm: $0.quantity.doubleValue(for: bpm))
        }
    }

    private static let maxPontosRota = 1500

    /// Rota do treino com até `maxPontosRota` pontos, junto com altitude, velocidade e FC de cada ponto.
    private func rotaDoTreino(_ w: HKWorkout, fc: [AmostraFC]) async -> (polyline: String, vetores: RotaPayload)? {
        do {
            let descritor = HKAnchoredObjectQueryDescriptor(
                predicates: [.workoutRoute(HKQuery.predicateForObjects(from: w))],
                anchor: nil
            )
            let resultado = try await descritor.result(for: store)
            var locais: [CLLocation] = []
            for rota in resultado.addedSamples {
                for try await loc in HKWorkoutRouteQueryDescriptor(rota).results(for: store) {
                    locais.append(loc)
                }
            }
            guard locais.count >= 2 else { return nil }
            locais.sort { $0.timestamp < $1.timestamp }

            // pontos igualmente espaçados (sempre com o primeiro e o último)
            let n = locais.count
            let alvo = min(n, Self.maxPontosRota)
            let indices = (0..<alvo).map { alvo > 1 ? Int((Double($0) * Double(n - 1) / Double(alvo - 1)).rounded()) : 0 }
            let escolhidos = indices.map { locais[$0] }

            // FC mais próxima no tempo de cada ponto (as amostras estão em ordem)
            let fcOrdenado = fc.sorted { $0.data < $1.data }
            var j = 0
            let fcPorPonto: [Double]? = fcOrdenado.isEmpty ? nil : escolhidos.map { loc in
                while j + 1 < fcOrdenado.count,
                      abs(fcOrdenado[j + 1].data.timeIntervalSince(loc.timestamp)) <= abs(fcOrdenado[j].data.timeIntervalSince(loc.timestamp)) {
                    j += 1
                }
                return fcOrdenado[j].bpm.rounded()
            }

            let coords = escolhidos.map { $0.coordinate }
            let vetores = RotaPayload(
                alt: escolhidos.map { ($0.altitude * 10).rounded() / 10 },
                vel: escolhidos.map { max($0.speed, 0) }.map { ($0 * 100).rounded() / 100 },
                fc: fcPorPonto
            )
            return (Polyline.codificar(coords), vetores)
        } catch {
            return nil
        }
    }

    private func classificar(_ t: HKWorkoutActivityType) -> (TipoSaude, String) {
        switch t {
        case .running: (.corrida, "running")
        case .walking: (.caminhada, "walking")
        case .hiking: (.caminhada, "hiking")
        case .traditionalStrengthTraining: (.musculacao, "traditionalStrengthTraining")
        case .functionalStrengthTraining: (.musculacao, "functionalStrengthTraining")
        case .coreTraining: (.musculacao, "coreTraining")
        default: (.outro, "other(\(t.rawValue))")
        }
    }
}

struct RotaPayload: Codable {
    var alt: [Double]?
    var vel: [Double]?
    var fc: [Double]?
}

enum TipoSaude: String, Codable {
    case corrida, caminhada, musculacao, outro
}

struct TreinoSaudePayload: Codable {
    var healthId: String
    var tipo: String
    var tipoHealthKit: String
    var inicio: Date
    var fim: Date
    var duracaoSeg: Double
    var distanciaM: Double?
    var caloriasKcal: Double?
    var fcMedia: Double?
    var fcMaxima: Double?
    var cadenciaMedia: Double?
    var potenciaMediaW: Double?
    var passadaM: Double?
    var oscilacaoVerticalCm: Double?
    var contatoSoloMs: Double?
    var elevacaoGanhoM: Double?
    var polyline: String?
    /// vetores alinhados aos pontos da polyline
    var rota: RotaPayload?
    var splits: [SplitPayload]?
    var voltas: [VoltaPayload]?
    var eventos: [EventoPayload]?
}

enum Polyline {
    /// Reduz a rota a no máximo `maximo` pontos, escolhendo pontos igualmente espaçados.
    static func reduzir(_ p: [CLLocationCoordinate2D], maximo: Int) -> [CLLocationCoordinate2D] {
        guard p.count > maximo, maximo > 1 else { return p }
        return (0..<maximo).map { p[Int(Double($0) * Double(p.count - 1) / Double(maximo - 1))] }
    }

    /// Google Encoded Polyline, precisão 5.
    static func codificar(_ pontos: [CLLocationCoordinate2D]) -> String {
        var lat = 0, lng = 0
        var out = ""
        func valor(_ v: Int) -> String {
            var n = v < 0 ? ~(v << 1) : (v << 1)
            var s = ""
            while n >= 0x20 {
                s.append(Character(UnicodeScalar((0x20 | (n & 0x1f)) + 63)!))
                n >>= 5
            }
            s.append(Character(UnicodeScalar(n + 63)!))
            return s
        }
        for p in pontos {
            let la = Int((p.latitude * 1e5).rounded())
            let ln = Int((p.longitude * 1e5).rounded())
            out += valor(la - lat) + valor(ln - lng)
            lat = la
            lng = ln
        }
        return out
    }
}

extension Array {
    func chunked(_ n: Int) -> [[Element]] {
        stride(from: 0, to: count, by: n).map { Array(self[$0..<Swift.min($0 + n, count)]) }
    }
}
