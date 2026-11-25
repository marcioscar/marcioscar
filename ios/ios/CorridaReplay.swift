import CoreLocation
import SwiftUI

/// O que o replay precisa de uma corrida, venha ela das maratonas (site) ou dos Resultados (Saúde).
struct CorridaReplay: Identifiable {
    let id = UUID()
    var titulo: String
    var distanciaKm: Double
    var tempoSeg: Double
    var paceSeg: Double
    /// tempo acumulado ao longo da distância: km e seg sempre crescentes, de (0, 0) até a chegada
    var curva: [(km: Double, seg: Double)]
    /// false = o GPS não é confiável e o corredor vai no ritmo médio
    var parciaisConfiaveis = true
    var coords: [CLLocationCoordinate2D]
    var colorida: RotaColorida
    /// por ponto da rota; vazio quando não há
    var paces: [Double] = []
    var fc: [Double] = []
    var altitude: [Double] = []
    var icone = "figure.run"

    /// prova inteira em 60 s; corridas curtas passam mais depressa
    var duracaoBase: Double { min(60, max(20, 15 + distanciaKm * 1.5)) }

    func tempo(noKm km: Double) -> Double { interpolar(km, \.km, \.seg) }
    func km(noTempo seg: Double) -> Double { interpolar(seg, \.seg, \.km) }

    private func interpolar(_ v: Double, _ x: KeyPath<(km: Double, seg: Double), Double>, _ y: KeyPath<(km: Double, seg: Double), Double>) -> Double {
        guard curva.count > 1 else { return 0 }
        var a = 0, b = curva.count - 1
        if v <= curva[a][keyPath: x] { return curva[a][keyPath: y] }
        if v >= curva[b][keyPath: x] { return curva[b][keyPath: y] }
        while b - a > 1 {
            let meio = (a + b) / 2
            if curva[meio][keyPath: x] <= v { a = meio } else { b = meio }
        }
        let d = curva[b][keyPath: x] - curva[a][keyPath: x]
        let f = d > 0 ? (v - curva[a][keyPath: x]) / d : 0
        return curva[a][keyPath: y] + (curva[b][keyPath: y] - curva[a][keyPath: y]) * f
    }

    /// Pace suavizado a partir da velocidade por ponto (0 = parado).
    static func paces(daVelocidade vel: [Double]) -> [Double] {
        vel.indices.map { i in
            let janela = vel[max(0, i - 8)...min(vel.count - 1, i + 8)].filter { $0 > 0.6 }
            return janela.isEmpty ? 0 : 1000 / (janela.reduce(0, +) / Double(janela.count))
        }
    }
}

extension CorridaReplay {
    /// Maratona do site, com a rota completa quando já carregou.
    init(m: Maratona, coords c: [CLLocationCoordinate2D], rota: RotaMaratona?, colorida: RotaColorida) {
        var curva: [(km: Double, seg: Double)] = [(0, 0)]
        if m.temParciais, let t = m.tempoKm { for (i, s) in t.enumerated() { curva.append((Double(i + 1), s)) } }
        curva.append((Maratona.distanciaKm, m.tempoSeg))
        func serie(_ v: [Double]?) -> [Double] { v.flatMap { $0.count == c.count ? $0 : nil } ?? [] }
        // sem parciais confiáveis (Chicago), a velocidade do GPS também não serve
        var paces = m.temParciais ? Self.paces(daVelocidade: serie(rota?.vel)) : []
        if paces.isEmpty, let pk = m.pacesKm, !pk.isEmpty {
            paces = c.indices.map { pk[min(pk.count - 1, $0 * pk.count / max(c.count, 1))] }
        }
        self.init(titulo: "\(m.bandeira) \(m.rotulo)", distanciaKm: Maratona.distanciaKm, tempoSeg: m.tempoSeg, paceSeg: m.paceSeg,
                  curva: curva, parciaisConfiaveis: m.temParciais, coords: c, colorida: colorida,
                  paces: paces, fc: serie(rota?.fc), altitude: serie(rota?.alt))
    }

    /// Corrida do dia a dia (Resultados). nil quando não há rota.
    init?(r: ResultadoCorrida, titulo: String, icone: String) {
        let c = r.coordenadas
        let distKm = r.distanciaM / 1000
        guard c.count > 10, distKm > 0.2, r.tempoSeg > 60 else { return nil }

        // dentro de cada km, o tempo segue o pace da série (tiros e descansos aparecem)...
        var fina: [(km: Double, seg: Double)] = [(0, 0)]
        for p in r.serie where p.km > fina[fina.count - 1].km + 0.001 && p.km < distKm {
            let ant = fina[fina.count - 1]
            fina.append((p.km, ant.seg + (p.km - ant.km) * (p.pace ?? 900)))
        }
        let ult = fina[fina.count - 1]
        fina.append((distKm, ult.seg + max(distKm - ult.km, 0.001) * r.tempoSeg / distKm))

        // ...e cada km fecha com o tempo do split do relógio
        var marcos: [(km: Double, seg: Double)] = [(0, 0)]
        for s in r.splits where s.distanciaM > 0 && s.tempoSeg > 0 {
            let ant = marcos[marcos.count - 1]
            let km = ant.km + s.distanciaM / 1000
            if km < distKm - 0.05 { marcos.append((km, ant.seg + s.tempoSeg)) } else { break }
        }
        if marcos[marcos.count - 1].seg >= r.tempoSeg { marcos = [(0, 0)] }
        marcos.append((distKm, r.tempoSeg))

        func bruto(_ km: Double) -> Double {
            guard let j = fina.firstIndex(where: { $0.km >= km }), j > 0 else { return 0 }
            let a = fina[j - 1], b = fina[j]
            return a.seg + (b.seg - a.seg) * (km - a.km) / max(b.km - a.km, 1e-9)
        }
        var curva: [(km: Double, seg: Double)] = [(0, 0)]
        var j = 1
        for i in 1..<marcos.count {
            let a = marcos[i - 1], b = marcos[i]
            let ba = bruto(a.km), bb = bruto(b.km)
            let escala = bb > ba ? (b.seg - a.seg) / (bb - ba) : 0
            while j < fina.count, fina[j].km < b.km - 0.0005 {
                if fina[j].km > a.km + 0.0005 { curva.append((fina[j].km, a.seg + (fina[j].seg - ba) * escala)) }
                j += 1
            }
            curva.append(b)
        }

        // FC e altitude vêm da série, que é por distância
        func porPonto(_ chave: KeyPath<PontoSerie, Double?>) -> [Double] {
            let pts = r.serie.compactMap { p in p[keyPath: chave].map { (km: p.km, v: $0) } }
            guard pts.count > 10 else { return [] }
            let n = c.count
            var acumulado = [0.0]
            for i in 1..<n {
                acumulado.append(acumulado[i - 1] + CLLocation(latitude: c[i].latitude, longitude: c[i].longitude)
                    .distance(from: CLLocation(latitude: c[i - 1].latitude, longitude: c[i - 1].longitude)))
            }
            let total = max(acumulado[n - 1], 1)
            var k = 0
            return acumulado.map { d in
                let km = d / total * distKm
                while k < pts.count - 1, pts[k].km < km { k += 1 }
                return pts[k].v
            }
        }
        let vel = r.velocidades.flatMap { $0.count == c.count ? $0 : nil }
        self.init(titulo: titulo, distanciaKm: distKm, tempoSeg: r.tempoSeg, paceSeg: r.tempoSeg / distKm, curva: curva,
                  coords: c, colorida: RotaColorida(coordenadas: c, velocidades: r.velocidades),
                  paces: vel.map { Self.paces(daVelocidade: $0) } ?? porPonto(\.pace),
                  fc: porPonto(\.fc), altitude: porPonto(\.alt), icone: icone)
    }
}
