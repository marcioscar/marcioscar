import SwiftUI

// Globo próprio (projeção ortográfica em Canvas): não usa o MapKit, que derrubava o app com o relevo 3D realista.

private struct Vetor {
    var x: Double, y: Double, z: Double
    init(lat: Double, lng: Double) {
        let a = lat * .pi / 180, b = lng * .pi / 180
        x = cos(a) * sin(b); y = sin(a); z = cos(a) * cos(b)
    }
    init(x: Double, y: Double, z: Double) { self.x = x; self.y = y; self.z = z }
}

private struct Projecao {
    let sla, cla, slo, clo, raio: Double
    let centro: CGPoint

    init(lat: Double, lng: Double, raio: Double, centro: CGPoint) {
        sla = sin(lat * .pi / 180); cla = cos(lat * .pi / 180)
        slo = sin(lng * .pi / 180); clo = cos(lng * .pi / 180)
        self.raio = raio; self.centro = centro
    }

    /// x à direita, y para cima, z em direção a quem olha
    func girar(_ v: Vetor) -> Vetor {
        let x = v.x * clo - v.z * slo
        let z = v.x * slo + v.z * clo
        return Vetor(x: x, y: v.y * cla - z * sla, z: v.y * sla + z * cla)
    }

    func ponto(_ v: Vetor) -> CGPoint {
        CGPoint(x: centro.x + v.x * raio, y: centro.y - v.y * raio)
    }

    func caminho(anel: [Vetor]) -> Path? {
        var visivel = false
        var p = Path()
        for (i, v) in anel.enumerated() {
            var g = girar(v)
            if g.z >= 0 { visivel = true } else {
                // atrás do horizonte: encosta na borda
                let n = max((g.x * g.x + g.y * g.y).squareRoot(), 1e-6)
                g = Vetor(x: g.x / n, y: g.y / n, z: 0)
            }
            if i == 0 { p.move(to: ponto(g)) } else { p.addLine(to: ponto(g)) }
        }
        guard visivel else { return nil }
        p.closeSubpath()
        return p
    }

    func linha(_ pts: [Vetor]) -> Path {
        var p = Path()
        var aberta = false
        for v in pts {
            let g = girar(v)
            if g.z < 0 { aberta = false; continue }
            if aberta { p.addLine(to: ponto(g)) } else { p.move(to: ponto(g)); aberta = true }
        }
        return p
    }
}

private struct PaisGlobo {
    let codigo: String
    let aneis: [[Vetor]]
}

private enum Mundo {
    private struct Bruto: Decodable { var c: String; var r: [[Double]] }

    static let paises: [PaisGlobo] = {
        guard let url = Bundle.main.url(forResource: "mundo", withExtension: "json"),
              let d = try? Data(contentsOf: url),
              let l = try? JSONDecoder().decode([Bruto].self, from: d) else { return [] }
        return l.map { b in
            PaisGlobo(codigo: b.c, aneis: b.r.map { r in
                stride(from: 0, to: r.count - 1, by: 2).map { Vetor(lat: r[$0 + 1], lng: r[$0]) }
            })
        }
    }()

    /// meridianos e paralelos a cada 30°
    static let grade: [[Vetor]] = {
        let meridianos = stride(from: -180.0, to: 180, by: 30).map { ln in stride(from: -90.0, through: 90, by: 5).map { Vetor(lat: $0, lng: ln) } }
        let paralelos = stride(from: -60.0, through: 60, by: 30).map { la in stride(from: -180.0, through: 180, by: 5).map { Vetor(lat: la, lng: $0) } }
        return meridianos + paralelos
    }()
}

/// Arco do grande círculo entre dois pontos.
private func arco(_ a: Vetor, _ b: Vetor) -> [Vetor] {
    let cosseno = min(1, max(-1, a.x * b.x + a.y * b.y + a.z * b.z))
    let w = acos(cosseno)
    guard w > 0.001, w < 3.13 else { return [a, b] }
    return (0...40).map { i in
        let t = Double(i) / 40
        let p = sin((1 - t) * w) / sin(w), q = sin(t * w) / sin(w)
        return Vetor(x: a.x * p + b.x * q, y: a.y * p + b.y * q, z: a.z * p + b.z * q)
    }
}

/// Desenha o globo virado para (lat, lng). `Animatable` para o voo entre cidades ser suave.
struct GloboDesenho: View, Animatable {
    let store: MaratonasStore
    var lat: Double
    var lng: Double
    var zoom: Double
    let selecionada: String?
    var tocar: (Maratona) -> Void

    var animatableData: AnimatablePair<Double, AnimatablePair<Double, Double>> {
        get { AnimatablePair(lat, AnimatablePair(lng, zoom)) }
        set { lat = newValue.first; lng = newValue.second.first; zoom = newValue.second.second }
    }

    var body: some View {
        let visitados = Set(store.todas.compactMap(\.codigoPais))
        GeometryReader { geo in
            let centro = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
            let pr = Projecao(lat: lat, lng: lng, raio: min(geo.size.width, geo.size.height) * 0.46 * zoom, centro: centro)
            ZStack {
                Canvas { ctx, _ in desenhar(&ctx, pr, visitados) }
                ForEach(store.todas) { m in
                    if let c = store.pontos[m.id] {
                        let g = pr.girar(Vetor(lat: c.latitude, lng: c.longitude))
                        let p = pr.ponto(g)
                        if g.z > 0.05, p.x > -20, p.x < geo.size.width + 20, p.y > -20, p.y < geo.size.height + 20 {
                            Button { tocar(m) } label: { Pino(m: m, ativo: m.id == selecionada, recorde: m.id == store.melhor?.id) }
                                .buttonStyle(.plain)
                                .accessibilityLabel("\(m.nome), \(m.ano)")
                                .position(p)
                        }
                    }
                }
            }
        }
    }

    private func desenhar(_ ctx: inout GraphicsContext, _ pr: Projecao, _ visitados: Set<String>) {
        let c = pr.centro, r = pr.raio
        let disco = Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r))
        let halo = Path(ellipseIn: CGRect(x: c.x - r * 1.06, y: c.y - r * 1.06, width: 2.12 * r, height: 2.12 * r))
        ctx.fill(halo, with: .radialGradient(Gradient(colors: [Tema.azul.opacity(0.55), .clear]), center: c, startRadius: r * 0.97, endRadius: r * 1.06))
        ctx.fill(disco, with: .radialGradient(
            Gradient(colors: [Color(red: 0.20, green: 0.46, blue: 0.80), Color(red: 0.05, green: 0.16, blue: 0.38)]),
            center: CGPoint(x: c.x - r * 0.35, y: c.y - r * 0.4), startRadius: 0, endRadius: r * 1.5
        ))
        for l in Mundo.grade { ctx.stroke(pr.linha(l), with: .color(.white.opacity(0.10)), lineWidth: 0.6) }
        for pais in Mundo.paises {
            let cor = visitados.contains(pais.codigo) ? Tema.lima : Color(red: 0.42, green: 0.62, blue: 0.50)
            for anel in pais.aneis {
                guard let p = pr.caminho(anel: anel) else { continue }
                ctx.fill(p, with: .color(cor))
                ctx.stroke(p, with: .color(.black.opacity(0.22)), lineWidth: 0.5)
            }
        }
        // ligações entre as provas, na ordem em que foram corridas
        let pts = store.todas.compactMap { store.pontos[$0.id] }.map { Vetor(lat: $0.latitude, lng: $0.longitude) }
        for (a, b) in zip(pts, pts.dropFirst()) {
            ctx.stroke(pr.linha(arco(a, b)), with: .color(Tema.laranja.opacity(0.85)), style: StrokeStyle(lineWidth: 1.4, dash: [5, 4]))
        }
        // sombra na borda, para dar volume
        ctx.fill(disco, with: .radialGradient(Gradient(colors: [.clear, .black.opacity(0.35)]), center: CGPoint(x: c.x - r * 0.2, y: c.y - r * 0.2), startRadius: r * 0.65, endRadius: r * 1.25))
    }
}

struct Pino: View {
    let m: Maratona
    let ativo: Bool
    let recorde: Bool

    var body: some View {
        Text(m.bandeira)
            .font(.system(size: ativo ? 22 : 14))
            .frame(width: ativo ? 40 : 25, height: ativo ? 40 : 25)
            .background(.white, in: Circle())
            .overlay(Circle().stroke(recorde ? Tema.ouro : (ativo ? Tema.laranja : .white), lineWidth: recorde || ativo ? 3 : 1))
            .shadow(color: .black.opacity(0.35), radius: 2, y: 1)
            .overlay(alignment: .topTrailing) {
                if recorde {
                    Image(systemName: "star.fill").font(.system(size: 8)).foregroundStyle(.white)
                        .padding(3).background(Tema.ouro, in: Circle()).offset(x: 5, y: -5)
                }
            }
    }
}
