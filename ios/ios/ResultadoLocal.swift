import CoreLocation
import Foundation

/// Monta o resultado de uma corrida a partir do que foi lido do app Saúde, sem passar pelo site.
/// (As contas espelham as do site: suavização do pace por distância, tempo por zona e nomes das etapas.)
enum ConstrutorResultado {
    // MARK: série pace / FC / altitude contra a distância

    private static let velocidadeMinima = 1.4 // m/s: abaixo disso é parado ou caminhando

    private static func metros(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        CLLocation(latitude: a.latitude, longitude: a.longitude).distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude))
    }

    /// Média dentro de uma janela em metros, centrada em cada ponto.
    private static func suavizar(_ valores: [Double?], _ dist: [Double], janela: Double) -> [Double?] {
        let metade = janela / 2
        var saida = [Double?](repeating: nil, count: valores.count)
        var ini = 0, fim = 0
        for i in 0..<valores.count {
            guard valores[i] != nil else { continue }
            while dist[ini] < dist[i] - metade { ini += 1 }
            while fim + 1 < dist.count, dist[fim + 1] <= dist[i] + metade { fim += 1 }
            var soma = 0.0, n = 0.0
            for k in ini...fim { if let v = valores[k] { soma += v; n += 1 } }
            saida[i] = n > 0 ? soma / n : nil
        }
        return saida
    }

    static func serie(polyline: String?, rota: RotaPayload?, distanciaM: Double) -> [PontoSerie] {
        guard let polyline, !polyline.isEmpty else { return [] }
        let coords = PolylineDecoder.decodificar(polyline)
        let n = coords.count
        guard n >= 2 else { return [] }

        var acumulado = [0.0]
        for i in 1..<n { acumulado.append(acumulado[i - 1] + metros(coords[i - 1], coords[i])) }
        let total = max(acumulado[n - 1], 1)
        let escala = distanciaM > 0 ? distanciaM / total : 1
        let dist = acumulado.map { $0 * escala }

        func vetor(_ v: [Double]?) -> [Double]? { (v?.count == n) ? v : nil }
        // pace: média das velocidades na janela (média de paces distorce) e só depois vira pace
        let vel: [Double?] = vetor(rota?.vel).map { $0.map { $0 >= velocidadeMinima ? $0 : nil } } ?? Array(repeating: nil, count: n)
        let janelaPace: Double = distanciaM < 12_000 ? 100 : 300
        let velSuave = suavizar(vel, dist, janela: janelaPace)
        let fc = suavizar(vetor(rota?.fc).map { $0.map { $0 > 0 ? $0 : nil } } ?? Array(repeating: nil, count: n), dist, janela: 150)
        let alt = suavizar(vetor(rota?.alt).map { $0.map { Optional($0) } } ?? Array(repeating: nil, count: n), dist, janela: 100)

        let passo = max(1, n / 400)
        return stride(from: 0, to: n, by: passo).map { i in
            PontoSerie(
                km: dist[i] / 1000,
                pace: velSuave[i].map { (1000 / $0).rounded() },
                fc: fc[i].map { $0.rounded() },
                alt: alt[i].map { ($0 * 10).rounded() / 10 }
            )
        }
    }

    // MARK: tempo por zona

    private static let limitesPace: [(id: String, nome: String, lento: Double, rapido: Double)] = [
        ("Z1", "Recuperação", 435, 375), ("Z2", "Fácil / Longão", 375, 340), ("Z3", "Maratona", 340, 305),
        ("Z4", "Limiar", 305, 285), ("Z5", "VO2 máx", 285, 265), ("Z6", "Velocidade", 265, 230),
    ]

    private static func rotuloPace(_ s: Double) -> String { "\(Int(s) / 60):" + String(format: "%02d", Int(s) % 60) }

    static func zonas(rota: RotaPayload?, tempoSeg: Double, fcMaxima: Double) -> ZonasResultado {
        var pace: [LinhaZonaResultado]?
        var fc: [LinhaZonaResultado]?

        if let v = rota?.vel, v.count > 10 {
            // vizinhança de 2 pontos, como no site
            let suave: [Double] = v.indices.map { i in
                let faixa = v[max(0, i - 2)...min(v.count - 1, i + 2)]
                return faixa.reduce(0, +) / Double(faixa.count)
            }
            var contagem = [Int](repeating: 0, count: limitesPace.count)
            var parado = 0
            for x in suave {
                if x < velocidadeMinima { parado += 1; continue }
                let p = 1000 / x
                // mais lento que Z1 → Z1; mais rápido que Z6 → Z6
                let idx = limitesPace.firstIndex { p > $0.rapido } ?? (limitesPace.count - 1)
                contagem[idx] += 1
            }
            let total = Double(suave.count)
            var linhas = limitesPace.enumerated().map { i, z in
                LinhaZonaResultado(
                    id: z.id, nome: z.nome, faixa: "\(rotuloPace(z.lento))–\(rotuloPace(z.rapido)) /km",
                    pct: Double(contagem[i]) / total * 100, seg: Double(contagem[i]) / total * tempoSeg, ordem: i + 1
                )
            }
            if Double(parado) / total >= 0.01 {
                linhas.insert(LinhaZonaResultado(id: "—", nome: "Parado ou caminhando", faixa: "mais lento que 11:55 /km",
                                                 pct: Double(parado) / total * 100, seg: Double(parado) / total * tempoSeg, ordem: 0), at: 0)
            }
            pace = linhas
        }

        if let f = rota?.fc, f.count > 10, fcMaxima > 0 {
            let faixas: [(String, String, Double, Double)] = [
                ("Z1", "Recuperação", 0, 0.6), ("Z2", "Aeróbico leve", 0.6, 0.7), ("Z3", "Aeróbico", 0.7, 0.8),
                ("Z4", "Limiar", 0.8, 0.9), ("Z5", "Máximo", 0.9, 2),
            ]
            var contagem = [Int](repeating: 0, count: faixas.count)
            var validos = 0
            for bpm in f where bpm > 0 {
                let frac = bpm / fcMaxima
                if let i = faixas.firstIndex(where: { frac >= $0.2 && frac < $0.3 }) { contagem[i] += 1; validos += 1 }
            }
            if validos > 0 {
                fc = faixas.enumerated().map { i, z in
                    let faixa = z.0 == "Z1" ? "abaixo de \(Int(fcMaxima * z.3)) bpm"
                        : z.0 == "Z5" ? "acima de \(Int(fcMaxima * z.2)) bpm"
                        : "\(Int(fcMaxima * z.2))–\(Int(fcMaxima * z.3)) bpm"
                    return LinhaZonaResultado(id: z.0, nome: z.1, faixa: faixa,
                                              pct: Double(contagem[i]) / Double(validos) * 100,
                                              seg: Double(contagem[i]) / Double(validos) * tempoSeg, ordem: i + 1)
                }
            }
        }
        return ZonasResultado(pace: pace, fc: fc, fcMaxima: fcMaxima)
    }

    // MARK: nomes das etapas (aquecimento, esforço, descanso, desaquecimento)

    /// O relógio grava a posição de cada etapa ("bloco.repetição.passo"), não o nome.
    static func nomearEtapas(_ voltas: [VoltaPayload]) -> [VoltaPayload] {
        guard !voltas.isEmpty, voltas.allSatisfy({ $0.tipo == "etapa" }) else { return voltas }
        let caminhos: [[Int]] = voltas.map { ($0.metadados?["WOIntervalStepKeyPath"] ?? "").split(separator: ".").compactMap { Int($0) } }
        guard caminhos.allSatisfy({ $0.count == 3 }) else { return voltas }

        var passosPorBloco: [Int: Int] = [:]
        for c in caminhos { passosPorBloco[c[0]] = max(passosPorBloco[c[0]] ?? 0, c[2] + 1) }
        let blocos = passosPorBloco.keys.sorted()
        guard let primeiro = blocos.first, let ultimo = blocos.last else { return voltas }

        return voltas.enumerated().map { i, v in
            var v = v
            let c = caminhos[i]
            let passos = passosPorBloco[c[0]] ?? 1
            if blocos.count > 1, c[0] == primeiro, passos == 1 { v.rotulo = "Aquecimento" }
            else if blocos.count > 1, c[0] == ultimo, passos == 1 { v.rotulo = "Desaquecimento" }
            else if passos > 1, c[2] == 0 { v.rotulo = "Esforço" }
            else if passos > 1 { v.rotulo = v.distanciaM < 150 ? "Descanso" : "Recuperação" }
            else { v.rotulo = "Etapa \(i + 1)" }
            return v
        }
    }

    // MARK: etapas válidas

    /// Só entram etapas de um treino estruturado (quando o relógio grava cada passo como atividade). Corridas livres
    /// vêm do relógio com segmentos automáticos a cada km e a cada milha, que se sobrepõem e não são etapas: somariam mais
    /// km do que a corrida e teriam distâncias quebradas. Mesma regra que o site aplica.
    static func etapasValidas(_ voltas: [VoltaPayload], distanciaTotalM: Double) -> [VoltaPayload] {
        var candidatas: [VoltaPayload]
        if voltas.count >= 2, voltas.allSatisfy({ $0.tipo == "etapa" }) {
            candidatas = nomearEtapas(voltas)
        } else {
            guard voltas.count >= 3 else { return [] }
            let ordenadas = voltas.sorted { $0.inicio < $1.inicio }
            var sobrepostas = 0
            for i in 1..<ordenadas.count where ordenadas[i].inicio < ordenadas[i - 1].fim.addingTimeInterval(-1) { sobrepostas += 1 }
            guard sobrepostas < max(2, ordenadas.count / 4) else { return [] }
            candidatas = ordenadas
        }
        // as etapas nunca podem somar bem mais do que a corrida inteira
        let soma = candidatas.reduce(0) { $0 + $1.distanciaM }
        if distanciaTotalM > 0, soma > distanciaTotalM * 1.1 { return [] }
        return candidatas
    }

    // MARK: resultado completo

    static func montar(payload p: TreinoSaudePayload, fcMaxima: Double) -> ResultadoCorrida {
        let tempo = p.duracaoSeg
        let distancia = p.distanciaM ?? 0
        let voltas = etapasValidas(p.voltas ?? [], distanciaTotalM: distancia)

        return ResultadoCorrida(
            id: p.healthId,
            nome: "Corrida",
            dataInicio: ISO8601DateFormatter.comFracao.string(from: p.inicio),
            distanciaM: distancia,
            tempoSeg: tempo,
            duracaoTotalSeg: p.fim.timeIntervalSince(p.inicio),
            elevacaoGanhoM: p.elevacaoGanhoM,
            paceSegKm: distancia >= 150 ? tempo / (distancia / 1000) : nil,
            metricas: MetricasResultado(
                fcMedia: p.fcMedia, fcMaxima: p.fcMaxima, caloriasKcal: p.caloriasKcal, cadencia: p.cadenciaMedia,
                potenciaW: p.potenciaMediaW, passadaM: p.passadaM, oscilacaoCm: p.oscilacaoVerticalCm, contatoMs: p.contatoSoloMs
            ),
            polyline: p.polyline,
            serie: serie(polyline: p.polyline, rota: p.rota, distanciaM: distancia),
            splits: (p.splits ?? []).map { SplitKm(km: $0.km, distanciaM: $0.distanciaM, tempoSeg: $0.tempoSeg, fcMedia: $0.fcMedia) },
            voltas: voltas.count > 1 ? voltas.map {
                VoltaResultado(rotulo: $0.rotulo ?? "Etapa \($0.indice)", distanciaM: $0.distanciaM, tempoSeg: $0.tempoSeg,
                               fcMedia: $0.fcMedia, potenciaW: $0.potenciaW, cadencia: $0.cadencia,
                               passadaM: $0.passadaM, oscilacaoCm: $0.oscilacaoCm, contatoMs: $0.contatoMs)
            } : [],
            zonas: zonas(rota: p.rota, tempoSeg: tempo, fcMaxima: max(fcMaxima, p.fcMaxima ?? 0)),
            planejado: nil,
            comparacao: nil,
            analise: nil,
            analisadaEm: nil,
            velocidades: p.rota?.vel
        )
    }
}
