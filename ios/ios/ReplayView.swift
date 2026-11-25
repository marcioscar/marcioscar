import MapKit
import SwiftUI

// MARK: - Replay: o corredor percorre a prova no mapa, com o pace em cima

/// Tudo o que o replay precisa, calculado uma vez ao abrir.
private struct TrilhaReplay {
    let coords: [CLLocationCoordinate2D]
    /// km oficial (0 a 42,195) de cada ponto
    let km: [Double]
    /// pace suavizado (seg/km) de cada ponto; vazio = usa o pace por km da prova
    let paces: [Double]
    let fc: [Double]
    let altitude: [Double]
    /// perfil para desenhar: altitudes igualmente espaçadas em km (largada → chegada)
    let perfil: [Double]
    let rota: RotaColorida
    let pontosPorTrecho: Int
    let marcos: [(km: Int, ponto: CLLocationCoordinate2D)]
    let regiao: MKCoordinateRegion

    let distanciaKm: Double
    /// lado (m) do recorte do modo seguir
    let recorte: Double

    init(_ m: CorridaReplay) {
        let c = m.coords
        coords = c
        rota = m.colorida
        distanciaKm = m.distanciaKm
        paces = m.paces
        fc = m.fc
        altitude = m.altitude
        pontosPorTrecho = max(3, c.count / 90)

        var acumulado: [Double] = [0]
        for i in 1..<c.count {
            let a = CLLocation(latitude: c[i - 1].latitude, longitude: c[i - 1].longitude)
            acumulado.append(acumulado[i - 1] + a.distance(from: CLLocation(latitude: c[i].latitude, longitude: c[i].longitude)))
        }
        let total = max(acumulado.last ?? 1, 1)
        let kms = acumulado.map { $0 / total * m.distanciaKm }
        km = kms

        if m.altitude.count == c.count {
            let n = 160
            var j = 0
            let bruto: [Double] = (0...n).map { k in
                let alvo = Double(k) / Double(n) * m.distanciaKm
                while j < kms.count - 1, kms[j] < alvo { j += 1 }
                return m.altitude[j]
            }
            // média curta: tira o serrilhado do barômetro/GPS
            perfil = bruto.indices.map { i in
                let w = bruto[max(0, i - 1)...min(bruto.count - 1, i + 1)]
                return w.reduce(0, +) / Double(w.count)
            }
        } else {
            perfil = []
        }

        let passo = m.distanciaKm <= 12 ? 1 : (m.distanciaKm <= 25 ? 2 : 5)
        marcos = stride(from: passo, to: max(passo + 1, Int(m.distanciaKm.rounded(.up))), by: passo).compactMap { alvo in
            kms.firstIndex { $0 >= Double(alvo) }.map { (km: alvo, ponto: c[$0]) }
        }
        let la = c.map(\.latitude), ln = c.map(\.longitude)
        regiao = MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: (la.min()! + la.max()!) / 2, longitude: (ln.min()! + ln.max()!) / 2),
            span: MKCoordinateSpan(latitudeDelta: max((la.max()! - la.min()!) * 1.7, 0.004), longitudeDelta: max((ln.max()! - ln.min()!) * 1.4, 0.004))
        )
        recorte = min(2600, max(700, (la.max()! - la.min()!) * 111_000 * 0.35))
    }

    /// índice do ponto já alcançado e posição interpolada
    func posicao(km alvo: Double) -> (i: Int, ponto: CLLocationCoordinate2D) {
        var a = 0, b = km.count - 1
        while b - a > 1 {
            let meio = (a + b) / 2
            if km[meio] <= alvo { a = meio } else { b = meio }
        }
        let f = min(1, max(0, km[b] > km[a] ? (alvo - km[a]) / (km[b] - km[a]) : 0))
        return (f >= 1 ? b : a, CLLocationCoordinate2D(
            latitude: coords[a].latitude + (coords[b].latitude - coords[a].latitude) * f,
            longitude: coords[a].longitude + (coords[b].longitude - coords[a].longitude) * f
        ))
    }
}

@Observable
@MainActor
private final class EstadoReplay {
    var tempo = 0.0
    var tocando = false
    var seguir = false
    /// 0,5×, 1× ou 2×
    var velocidade = 1.0
    /// trechos já percorridos (só muda ~90 vezes, para o mapa não ser refeito a cada quadro)
    var trecho = -1
    /// muda quando o mapa se move, para o corredor acompanhar
    var camera = 0
    @ObservationIgnored var tarefa: Task<Void, Never>?
}

struct ReplayView: View {
    let m: CorridaReplay
    @State private var estado = EstadoReplay()
    @State private var camera: MapCameraPosition
    @State private var satelite = false
    @State private var trilha: TrilhaReplay
    @Environment(\.dismiss) private var dismiss

    init(_ corrida: CorridaReplay) {
        m = corrida
        let t = TrilhaReplay(corrida)
        _trilha = State(initialValue: t)
        _camera = State(initialValue: .region(t.regiao))
    }

    var body: some View {
        MapReader { proxy in
            Map(position: $camera, interactionModes: [.pan, .zoom]) {
                MapPolyline(coordinates: trilha.coords).stroke(.white, lineWidth: 8)
                MapPolyline(coordinates: trilha.coords).stroke(Tema.cinzaPausa.opacity(0.7), lineWidth: 4)
                ForEach(trilha.rota.trechos.filter { $0.id < estado.trecho }) { t in
                    MapPolyline(coordinates: t.coordenadas).stroke(t.cor, lineWidth: 5)
                }
                ForEach(trilha.marcos, id: \.km) { marco in
                    Annotation("", coordinate: marco.ponto) {
                        Text("\(marco.km)").font(.system(size: 10, weight: .heavy)).foregroundStyle(Tema.texto)
                            .frame(width: 22, height: 22).background(.white, in: Circle())
                            .overlay(Circle().stroke(Tema.texto.opacity(0.4), lineWidth: 1))
                    }
                }
                if let f = trilha.coords.last {
                    Annotation("Chegada", coordinate: f) {
                        Image(systemName: "flag.checkered").font(.caption.bold()).foregroundStyle(.white)
                            .padding(6).background(Tema.texto, in: Circle())
                    }
                }
            }
            .mapStyle(satelite ? .hybrid : .standard)
            .mapControls {}
            .onMapCameraChange(frequency: .continuous) { _ in estado.camera += 1 }
            .overlay { CorredorNoMapa(m: m, trilha: trilha, estado: estado, proxy: proxy) }
        }
        .ignoresSafeArea()
        .overlay(alignment: .top) { barraTopo }
        .overlay(alignment: .bottom) {
            PainelReplay(m: m, trilha: trilha, estado: estado, alternar: alternar, mover: { estado.tempo = $0; atualizarTrecho() })
        }
        .preferredColorScheme(.light)
        .onDisappear { estado.tarefa?.cancel() }
        .task {
            try? await Task.sleep(for: .seconds(1))
            if !Task.isCancelled, !estado.tocando, estado.tempo == 0 { alternar() }
        }
    }

    private var barraTopo: some View {
        HStack(spacing: 8) {
            botao("xmark", "Fechar") { dismiss() }
            Text(m.titulo).font(.headline).lineLimit(1).minimumScaleFactor(0.7)
                .padding(.horizontal, 14).frame(height: 46).background(.regularMaterial, in: Capsule())
            Spacer(minLength: 0)
            botao(estado.seguir ? "location.fill" : "location", estado.seguir ? "Parar de seguir" : "Seguir o corredor") {
                estado.seguir.toggle()
                if estado.seguir { acompanhar(1) } else { withAnimation(.easeInOut(duration: 1)) { camera = .region(trilha.regiao) } }
            }
            botao(satelite ? "map.fill" : "photo.fill", "Trocar mapa") { satelite.toggle() }
        }
        .foregroundStyle(Tema.texto)
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    private func botao(_ icone: String, _ rotulo: String, _ acao: @escaping () -> Void) -> some View {
        Button(action: acao) {
            Image(systemName: icone).font(.headline).frame(width: 46, height: 46).background(.regularMaterial, in: Circle())
        }
        .accessibilityLabel(rotulo)
    }

    private func acompanhar(_ duracao: Double) {
        let p = trilha.posicao(km: m.km(noTempo: estado.tempo)).ponto
        withAnimation(.linear(duration: duracao)) {
            camera = .region(MKCoordinateRegion(center: p, latitudinalMeters: trilha.recorte, longitudinalMeters: trilha.recorte))
        }
    }

    private func atualizarTrecho() {
        let i = trilha.posicao(km: m.km(noTempo: estado.tempo)).i
        let novo = i >= trilha.coords.count - 1 ? trilha.rota.trechos.count : i / trilha.pontosPorTrecho
        if novo != estado.trecho { estado.trecho = novo }
    }

    private func alternar() {
        if estado.tocando {
            estado.tarefa?.cancel()
            estado.tocando = false
            return
        }
        if estado.tempo >= m.tempoSeg { estado.tempo = 0; atualizarTrecho() }
        estado.tocando = true
        estado.tarefa = Task {
            let relogio = ContinuousClock()
            var antes = relogio.now
            var ultimaCamera = antes
            while !Task.isCancelled, estado.tempo < m.tempoSeg {
                try? await Task.sleep(for: .milliseconds(33))
                if Task.isCancelled { return }
                let agora = relogio.now
                let dt = (agora - antes) / .seconds(1)
                antes = agora
                estado.tempo = min(m.tempoSeg, estado.tempo + dt * estado.velocidade * m.tempoSeg / m.duracaoBase)
                atualizarTrecho()
                if estado.seguir, agora - ultimaCamera > .milliseconds(900) {
                    ultimaCamera = agora
                    acompanhar(1)
                }
            }
            estado.tocando = false
        }
    }
}

// MARK: - O corredor

/// Desenhado por cima do mapa: só esta parte é refeita a cada quadro.
private struct CorredorNoMapa: View {
    let m: CorridaReplay
    let trilha: TrilhaReplay
    let estado: EstadoReplay
    let proxy: MapProxy

    var body: some View {
        let _ = estado.camera
        let km = m.km(noTempo: estado.tempo)
        let pos = trilha.posicao(km: km)
        let pace = paceAgora(m: m, trilha: trilha, i: pos.i, km: km)
        let cor = corDaMarca(pace, trilha)
        GeometryReader { geo in
        if let g = proxy.convert(pos.ponto, to: .global) {
            VStack(spacing: 0) {
                Text("\(formatarPace(pace))/km")
                    .font(.subheadline.weight(.heavy)).monospacedDigit()
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(escuroProva, in: Capsule())
                Triangulo().fill(escuroProva).frame(width: 12, height: 7)
                Image(systemName: m.icone)
                    .font(.system(size: 18, weight: .bold)).foregroundStyle(.white)
                    .symbolEffect(.pulse, isActive: estado.tocando)
                    .frame(width: 36, height: 36)
                    .background(cor, in: Circle())
                    .overlay(Circle().stroke(.white, lineWidth: 3))
                    .shadow(color: .black.opacity(0.35), radius: 4, y: 2)
            }
            .fixedSize()
            .frame(height: 80, alignment: .bottom)
            // o centro do círculo (a 18 pt da base) fica sobre a rota
            .position(x: g.x - geo.frame(in: .global).minX, y: g.y - geo.frame(in: .global).minY - 22)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
        }
        .allowsHitTesting(false)
    }
}

private struct Triangulo: Shape {
    func path(in r: CGRect) -> Path {
        Path { p in
            p.move(to: CGPoint(x: r.minX, y: r.minY))
            p.addLine(to: CGPoint(x: r.maxX, y: r.minY))
            p.addLine(to: CGPoint(x: r.midX, y: r.maxY))
            p.closeSubpath()
        }
    }
}

private func paceAgora(m: CorridaReplay, trilha: TrilhaReplay, i: Int, km: Double) -> Double {
    // 0 = parado (mostra um traço)
    if i < trilha.paces.count { return trilha.paces[i] }
    return m.paceSeg
}

private func corDaMarca(_ pace: Double, _ t: TrilhaReplay) -> Color {
    guard pace > 0 else { return Tema.cinzaPausa }
    guard let r = t.rota.paceRapido, let l = t.rota.paceLento, l > r else { return Tema.laranja }
    return corDoPace((pace - r) / (l - r))
}

// MARK: - Painel

private struct PainelReplay: View {
    let m: CorridaReplay
    let trilha: TrilhaReplay
    let estado: EstadoReplay
    var alternar: () -> Void
    var mover: (Double) -> Void

    var body: some View {
        let km = m.km(noTempo: estado.tempo)
        let i = trilha.posicao(km: km).i
        let chegou = estado.tempo >= m.tempoSeg
        VStack(spacing: 10) {
            HStack {
                item("km", (chegou ? m.distanciaKm : km).formatted(.number.precision(.fractionLength(chegou ? 2 : 1)).locale(Locale(identifier: "pt_BR"))))
                item("tempo", formatarDuracao(estado.tempo))
                item("média", km > 0.2 ? formatarPace(estado.tempo / km) : "—")
                if i < trilha.fc.count, trilha.fc[i] > 0 { item("bpm", "\(Int(trilha.fc[i]))", Tema.vermelho) }
                if i < trilha.altitude.count { item("alt.", "\(Int(trilha.altitude[i].rounded())) m") }
            }
            if trilha.perfil.count > 2 {
                PerfilReplay(perfil: trilha.perfil, distanciaKm: m.distanciaKm, km: km, cor: corDaMarca(paceAgora(m: m, trilha: trilha, i: i, km: km), trilha)) { mover(m.tempo(noKm: $0)) }
                    .frame(height: 64)
            }
            HStack(spacing: 12) {
                Button(action: alternar) {
                    Image(systemName: estado.tocando ? "pause.fill" : (chegou ? "arrow.counterclockwise" : "play.fill"))
                        .font(.headline).foregroundStyle(.white).frame(width: 46, height: 46).background(Tema.laranja, in: Circle())
                }
                .accessibilityLabel(estado.tocando ? "Pausar" : "Tocar")
                Slider(value: Binding(get: { estado.tempo }, set: { mover($0) }), in: 0...m.tempoSeg).tint(Tema.laranja)
                    .accessibilityLabel("Tempo de prova")
                Menu {
                    ForEach([(0.5, "Lento"), (1.0, "Normal"), (2.0, "Rápido"), (4.0, "Muito rápido")], id: \.0) { d in
                        Button(d.1) { estado.velocidade = d.0 }
                    }
                } label: {
                    Text(estado.velocidade == 0.5 ? "½×" : "\(Int(estado.velocidade))×")
                        .font(.subheadline.weight(.heavy)).frame(width: 44, height: 44).background(Color.black.opacity(0.06), in: Circle())
                }
                .accessibilityLabel("Velocidade do replay")
            }
            if !m.parciaisConfiaveis {
                Text("Sem parciais confiáveis nesta prova: o corredor vai no ritmo médio.").font(.caption2).foregroundStyle(Tema.textoSuave)
            }
        }
        .foregroundStyle(Tema.texto)
        .padding(14)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 22))
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
    }

    private func item(_ titulo: String, _ valor: String, _ cor: Color = Tema.texto) -> some View {
        VStack(spacing: 0) {
            Text(valor).font(.headline.weight(.heavy)).monospacedDigit().foregroundStyle(cor).lineLimit(1).minimumScaleFactor(0.6)
            Text(titulo).font(.caption2).foregroundStyle(Tema.textoSuave)
        }
        .frame(maxWidth: .infinity)
    }
}

/// Altimetria com o ponto acompanhando o corredor; arrastar leva a qualquer km.
private struct PerfilReplay: View {
    let perfil: [Double]
    let distanciaKm: Double
    let km: Double
    let cor: Color
    var irPara: (Double) -> Void

    private var passo: Double { distanciaKm <= 6 ? 1 : (distanciaKm <= 12 ? 2 : (distanciaKm <= 25 ? 5 : 10)) }

    var body: some View {
        let lo = perfil.min() ?? 0, hi = perfil.max() ?? 1
        // percurso plano não vira montanha: escala de pelo menos 40 m
        let faixa = max(hi - lo, 40)
        GeometryReader { g in
            let w = g.size.width, h = g.size.height - 14
            let y = { (a: Double) in h - 4 - (a - lo) / faixa * (h - 14) }
            let pos = min(1, max(0, km / distanciaKm)) * Double(perfil.count - 1)
            let i = min(perfil.count - 2, Int(pos))
            let alt = perfil[i] + (perfil[i + 1] - perfil[i]) * (pos - Double(i))
            let x = w * pos / Double(perfil.count - 1)

            let linha = Path { p in
                for (k, a) in perfil.enumerated() {
                    let pt = CGPoint(x: w * Double(k) / Double(perfil.count - 1), y: y(a))
                    if k == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
                }
            }
            let area = Path { p in
                p.addPath(linha)
                p.addLine(to: CGPoint(x: w, y: h))
                p.addLine(to: CGPoint(x: 0, y: h))
                p.closeSubpath()
            }
            ZStack(alignment: .topLeading) {
                area.fill(Tema.cinzaPausa.opacity(0.28))
                area.fill(Tema.roxo.opacity(0.40)).mask(alignment: .leading) { Rectangle().frame(width: x) }
                linha.stroke(Tema.roxo.opacity(0.8), lineWidth: 1.5)
                Path { p in p.move(to: CGPoint(x: x, y: y(alt))); p.addLine(to: CGPoint(x: x, y: h)) }
                    .stroke(Tema.texto.opacity(0.4), lineWidth: 1)
                Circle().fill(cor).frame(width: 14, height: 14)
                    .overlay(Circle().stroke(.white, lineWidth: 2.5))
                    .shadow(color: .black.opacity(0.3), radius: 2)
                    .position(x: min(w - 7, max(7, x)), y: y(alt))
                ForEach(Array(stride(from: passo, to: distanciaKm - passo * 0.25, by: passo)), id: \.self) { k in
                    Text("\(Int(k))").font(.system(size: 9)).foregroundStyle(Tema.textoSuave)
                        .position(x: w * k / distanciaKm, y: h + 7)
                }
                Text("\(Int(hi.rounded())) m").font(.system(size: 9, weight: .semibold)).foregroundStyle(Tema.textoSuave)
            }
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0).onChanged { v in
                irPara(min(1, max(0, v.location.x / max(w, 1))) * distanciaKm)
            })
        }
        .accessibilityElement()
        .accessibilityLabel("Altimetria do percurso")
    }
}
