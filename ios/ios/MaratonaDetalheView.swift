import Charts
import MapKit
import SwiftUI

// MARK: - Detalhe de uma maratona

struct MaratonaDetalheView: View {
    let m: Maratona
    let store: MaratonasStore

    @State private var rota: RotaMaratona?
    @State private var coords: [CLLocationCoordinate2D] = []
    @State private var colorida: RotaColorida?
    @State private var fotos: [FotoMaratona] = []
    @State private var mapaCheio = false
    @State private var replay: CorridaReplay?
    @State private var foto: FotoMaratona?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                topo
                if coords.count > 1 {
                    mapa
                    Button { if let colorida { replay = CorridaReplay(m: m, coords: coords, rota: rota, colorida: colorida) } } label: { Label("Reviver a prova no mapa", systemImage: "figure.run") }
                        .buttonStyle(BotaoPrincipal())
                }
                if !fotos.isEmpty { galeria }
                BlocoFotos(chave: m.chaveFotos)
                metricas
                if let l = m.leitura { BlocoLeitura(l: l) }
                if m.temParciais {
                    GraficoProva(m: m)
                    if let melhor = store.melhor, melhor.id != m.id, melhor.temParciais { ContraRecorde(m: m, melhor: melhor) }
                    Parciais(m: m)
                } else {
                    Label(m.gpsImpreciso
                        ? "O GPS mediu \(numeroBR((m.distanciaGpsM ?? 0) / 1000)) km nesta prova, então as parciais por km não são confiáveis e ficaram de fora."
                        : "Desta prova só há o tempo final: não houve registro de GPS.", systemImage: "info.circle")
                        .font(.footnote).foregroundStyle(Tema.textoSuave).padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading).cartao()
                }
                if let p = m.preparo { BlocoPreparo(p: p) }
                ranking
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
        }
        .background(FundoColorido())
        .navigationTitle(m.local)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                ShareLink(item: "\(m.bandeira) \(m.nome) · \(m.dataLonga)\n🏅 \(formatarDuracao(m.tempoSeg)) (\(formatarPace(m.paceSeg))/km) · minha \(m.numero)ª maratona")
            }
        }
        .task(id: m.id) { await carregar() }
        .fullScreenCover(isPresented: $mapaCheio) { MapaCheio(coords: coords, colorida: colorida) }
        .fullScreenCover(item: $replay) { ReplayView($0) }
        .fullScreenCover(item: $foto) { GaleriaCheia(fotos: fotos, inicial: $0.id) }
    }

    private func carregar() async {
        coords = store.rotas[m.id] ?? []
        colorida = RotaColorida(coordenadas: coords, velocidades: nil)
        guard m.stravaId > 0 else { return }
        async let r = try? Servidor.buscarRotaMaratona(stravaId: m.stravaId)
        if m.totalFotos > 0 { fotos = (try? await Servidor.buscarFotosMaratona(stravaId: m.stravaId)) ?? [] }
        if let completa = await r ?? nil {
            let c = PolylineDecoder.decodificar(completa.polyline)
            if c.count > 1 {
                rota = completa
                coords = c
                colorida = RotaColorida(coordenadas: c, velocidades: completa.vel)
            }
        }
    }

    private var topo: some View {
        let recorde = store.melhor?.id == m.id
        let eraRecorde = store.recordes.contains(m.id)
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                Text(m.bandeira).font(.system(size: 54))
                Spacer()
                VStack(alignment: .trailing, spacing: 6) {
                    SeloProva(texto: "42K · \(m.numero)ª")
                    if recorde { Selo(texto: "Recorde pessoal", cor: Tema.vermelho) } else if eraRecorde, m.numero > 1 { Selo(texto: "Foi recorde", cor: Tema.azul) }
                }
            }
            Text(m.nome).font(.title2.weight(.heavy)).foregroundStyle(.white)
            Text([m.cidade, m.pais, m.dataLonga].compactMap { $0 }.joined(separator: " · ")).font(.subheadline).foregroundStyle(.white.opacity(0.65))
            Text(formatarDuracao(m.tempoSeg)).font(.system(size: 56, weight: .heavy)).monospacedDigit().foregroundStyle(Tema.ouro)
            if let melhor = store.melhor, !recorde {
                Text("\(formatarDiferenca(m.tempoSeg - melhor.tempoSeg)) sobre o recorde (\(melhor.rotulo))").font(.footnote).foregroundStyle(.white.opacity(0.75))
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(escuroProva, in: RoundedRectangle(cornerRadius: 22))
        .padding(.top, 8)
    }

    private var mapa: some View {
        MapaProva(coords: coords, colorida: colorida, interativo: false, satelite: false)
            .id(coords.count)
            .frame(height: 280)
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .overlay(alignment: .topTrailing) {
                Image(systemName: "arrow.up.left.and.arrow.down.right").font(.footnote.weight(.semibold))
                    .padding(9).background(.ultraThinMaterial, in: Circle()).padding(10)
            }
            .contentShape(Rectangle())
            .onTapGesture { mapaCheio = true }
            .accessibilityLabel("Mapa da prova. Toque para ampliar.")
            .accessibilityAddTraits(.isButton)
    }

    private var galeria: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(fotos) { f in
                    Button { foto = f } label: {
                        AsyncImage(url: URL(string: f.url)) { i in i.resizable().scaledToFill() } placeholder: { Color.black.opacity(0.06) }
                            .frame(width: 190, height: 150)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(f.legenda ?? "Foto da prova")
                }
            }
        }
    }

    private var metricas: some View {
        var itens: [(String, String, String, Color)] = [
            ("Pace médio", "\(formatarPace(m.paceSeg)) /km", "speedometer", Tema.laranja),
            ("VPONTO", numeroBR(m.vponto), "gauge.with.dots.needle.67percent", Tema.aqua),
        ]
        if let v = m.fcMedia { itens.append(("FC média", "\(Int(v.rounded())) bpm", "heart.fill", Tema.vermelho)) }
        if let v = m.fcMaxima { itens.append(("FC máxima", "\(Int(v.rounded())) bpm", "bolt.heart.fill", Tema.vermelho)) }
        if let v = m.elevacaoM { itens.append(("Subida", "\(Int(v)) m", "mountain.2.fill", Tema.roxo)) }
        if let v = m.temperatura { itens.append(("Temperatura", "\(Int(v.rounded()))°C", "thermometer.medium", Tema.ouro)) }
        if let v = m.calorias { itens.append(("Calorias", "\(Int(v)) kcal", "flame.fill", Tema.laranja)) }
        if let v = m.distanciaGpsM { itens.append(("Medido no GPS", "\(numeroDuas(v / 1000)) km", "location.fill", Tema.azul)) }
        return LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
            ForEach(itens, id: \.0) { i in
                HStack(spacing: 10) {
                    IconeTreino(simbolo: i.2, cor: i.3, tamanho: 36)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(i.0).font(.caption).foregroundStyle(Tema.textoSuave)
                        Text(i.1).font(.headline).foregroundStyle(Tema.texto).lineLimit(1).minimumScaleFactor(0.7)
                    }
                    Spacer(minLength: 0)
                }
                .padding(12)
                .cartao(raio: 16)
            }
        }
    }

    private func numeroDuas(_ v: Double) -> String { v.formatted(.number.precision(.fractionLength(2)).locale(Locale(identifier: "pt_BR"))) }

    private var ranking: some View {
        let ordem = store.todas.sorted { $0.tempoSeg < $1.tempoSeg }
        let pos = (ordem.firstIndex(of: m) ?? 0) + 1
        return Secao(titulo: "\(pos)ª mais rápida de \(ordem.count)", icone: "list.number", tom: Tema.ouro) {
            Chart(ordem) { x in
                BarMark(x: .value("Prova", x.rotuloCurto), y: .value("Min", (x.tempoSeg - 12_600) / 60))
                    .foregroundStyle(x.id == m.id ? Tema.ouro : Tema.textoSuave.opacity(0.3))
                    .cornerRadius(3)
            }
            .chartXAxis(.hidden)
            .chartYAxis {
                AxisMarks(position: .leading) { v in
                    AxisGridLine()
                    AxisValueLabel { if let d = v.as(Double.self) { Text(formatarHorasMin(d * 60 + 12_600)).font(.caption2) } }
                }
            }
            .frame(height: 130)
            Text("Barras a partir de 3:30, da mais rápida para a mais lenta.").font(.caption2).foregroundStyle(Tema.textoSuave)
        }
    }
}

// MARK: - Mapa

private struct MapaProva: View {
    let coords: [CLLocationCoordinate2D]
    let colorida: RotaColorida?
    let interativo: Bool
    let satelite: Bool

    var body: some View {
        Map(initialPosition: .automatic, interactionModes: interativo ? .all : []) {
            MapPolyline(coordinates: coords).stroke(.white, lineWidth: 8)
            ForEach(colorida?.trechos ?? []) { t in MapPolyline(coordinates: t.coordenadas).stroke(t.cor, lineWidth: 5) }
            if let i = coords.first { Annotation("Largada", coordinate: i) { bolinha(Tema.aqua) } }
            if let f = coords.last { Annotation("Chegada", coordinate: f) { bolinha(Tema.texto) } }
        }
        .mapStyle(satelite ? .hybrid : .standard)
        .overlay(alignment: .bottomLeading) {
            if let r = colorida?.paceRapido, let l = colorida?.paceLento { LegendaRitmo(rapido: r, lento: l).padding(10) }
        }
    }

    private func bolinha(_ cor: Color) -> some View {
        Circle().fill(cor).frame(width: 14, height: 14).overlay(Circle().stroke(.white, lineWidth: 2.5))
    }
}

private struct MapaCheio: View {
    let coords: [CLLocationCoordinate2D]
    let colorida: RotaColorida?
    @State private var estilo: EstiloMapaApp = .padrao
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        MapaProva(coords: coords, colorida: colorida, interativo: true, satelite: estilo == .satelite)
            .ignoresSafeArea()
            .overlay(alignment: .top) {
                HStack {
                    Button { dismiss() } label: { Image(systemName: "xmark").font(.headline).frame(width: 46, height: 46).background(.regularMaterial, in: Circle()) }
                        .accessibilityLabel("Fechar mapa")
                    Spacer()
                    Picker("Estilo", selection: $estilo) { ForEach(EstiloMapaApp.allCases, id: \.self) { Text($0.rawValue) } }
                        .pickerStyle(.segmented).frame(width: 180).padding(4).background(.regularMaterial, in: Capsule())
                }
                .foregroundStyle(Tema.texto)
                .padding(.horizontal, 16)
                .padding(.top, 8)
            }
            .preferredColorScheme(.light)
    }
}

private struct GaleriaCheia: View {
    let fotos: [FotoMaratona]
    @State var inicial: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        TabView(selection: $inicial) {
            ForEach(fotos) { f in
                AsyncImage(url: URL(string: f.url)) { i in i.resizable().scaledToFit() } placeholder: { ProgressView().tint(.white) }.tag(f.id)
            }
        }
        .tabViewStyle(.page)
        .background(.black)
        .overlay(alignment: .topLeading) {
            Button { dismiss() } label: { Image(systemName: "xmark").font(.headline).foregroundStyle(.white).frame(width: 46, height: 46).background(.white.opacity(0.2), in: Circle()) }
                .padding(16)
                .accessibilityLabel("Fechar fotos")
        }
    }
}

// MARK: - Leitura da prova

private struct BlocoLeitura: View {
    let l: Maratona.Leitura

    private var texto: String {
        switch l.tipo {
        case "negativo": "Segunda metade mais rápida que a primeira: ritmo negativo, o sonho de todo maratonista."
        case "parelho": "Ritmo muito bem distribuído: as metades ficaram a menos de 2,5% uma da outra."
        default:
            if let k = l.kmQueda { "O muro apareceu no km \(k): dali em diante o ritmo não voltou ao dos km 5 a 20 (\(formatarPace(l.paceBaseSeg))/km)." } else { "Perdeu ritmo na segunda metade, aos poucos, sem uma quebra clara." }
        }
    }

    var body: some View {
        let total = l.primeiraMetadeSeg + l.segundaMetadeSeg
        Secao(titulo: "Leitura da prova", icone: "text.magnifyingglass", tom: Tema.roxo) {
            GeometryReader { g in
                HStack(spacing: 3) {
                    metade("1ª", l.primeiraMetadeSeg, Tema.aqua).frame(width: (g.size.width - 3) * l.primeiraMetadeSeg / max(total, 1))
                    metade("2ª", l.segundaMetadeSeg, l.tipo == "positivo" ? Tema.laranja : Tema.aqua)
                }
            }
            .frame(height: 48)
            Text("\(formatarDiferenca(l.diferencaSeg)) na segunda metade").font(.headline).monospacedDigit()
            Text(texto).font(.footnote).foregroundStyle(Tema.textoSuave)
        }
    }

    private func metade(_ n: String, _ t: Double, _ cor: Color) -> some View {
        VStack(spacing: 0) {
            Text("\(n) metade").font(.caption2)
            Text(formatarDuracao(t)).font(.subheadline.weight(.heavy)).monospacedDigit()
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(cor, in: RoundedRectangle(cornerRadius: 10))
    }
}

// MARK: - Gráficos

private struct GraficoProva: View {
    let m: Maratona
    @State private var toque: Int?

    var body: some View {
        let paces = m.pacesKm ?? []
        let lo = (paces.min() ?? 300) - 15, hi = (paces.max() ?? 480) + 5
        let k = toque.map { min(42, max(1, $0)) }
        Secao(titulo: "Km a km", icone: "chart.bar.fill", tom: Tema.laranja) {
            HStack(spacing: 14) {
                if let k, k <= paces.count {
                    Text("km \(k)").bold()
                    Text("\(formatarPace(paces[k - 1]))/km").bold().foregroundStyle(Tema.laranja)
                    if let f = m.fcKm?[k - 1] { Text("\(Int(f)) bpm").bold().foregroundStyle(Tema.vermelho) }
                    Spacer()
                    if let t = m.tempoKm { Text(formatarDuracao(t[k - 1])).foregroundStyle(Tema.textoSuave) }
                } else {
                    Text("Arraste para ver cada km").foregroundStyle(Tema.textoSuave)
                }
            }
            .font(.footnote).monospacedDigit().frame(height: 18)

            Text("Ritmo (mais alto = mais rápido)").font(.caption).foregroundStyle(Tema.textoSuave)
            Chart {
                ForEach(paces.indices, id: \.self) { i in
                    // barra que sobe quanto mais rápido o km
                    BarMark(x: .value("km", i + 1), y: .value("Ritmo", hi - paces[i]), width: .ratio(0.8))
                        .foregroundStyle(corDoPace((paces[i] - 305) / 175))
                        .opacity(k == nil || k == i + 1 ? 1 : 0.45)
                }
                RuleMark(y: .value("Média", hi - m.paceSeg)).lineStyle(StrokeStyle(lineWidth: 1.5, dash: [5, 4])).foregroundStyle(Tema.texto.opacity(0.6))
                    .annotation(position: .top, alignment: .trailing) { Text("média \(formatarPace(m.paceSeg))").font(.caption2).foregroundStyle(Tema.texto) }
            }
            .chartYScale(domain: 0...(hi - lo))
            .chartYAxis {
                AxisMarks(position: .leading, values: .automatic(desiredCount: 4)) { v in
                    AxisGridLine()
                    AxisValueLabel { if let d = v.as(Double.self) { Text(formatarPace(hi - d)).font(.caption2).frame(width: 34, alignment: .trailing) } }
                }
            }
            .modifier(EixoKm(toque: $toque))
            .frame(height: 170)

            if let fc = m.fcKm {
                let vals = fc.compactMap { $0 }
                Text("Frequência cardíaca").font(.caption).foregroundStyle(Tema.textoSuave)
                Chart {
                    ForEach(fc.indices, id: \.self) { i in
                        if let v = fc[i] {
                            LineMark(x: .value("km", i + 1), y: .value("bpm", v)).foregroundStyle(Tema.vermelho).interpolationMethod(.monotone)
                        }
                    }
                    if let k { RuleMark(x: .value("km", k)).foregroundStyle(Tema.texto.opacity(0.3)) }
                }
                .chartYScale(domain: ((vals.min() ?? 100) - 5)...((vals.max() ?? 190) + 5))
                .chartYAxis { eixoInteiro }
                .modifier(EixoKm(toque: $toque))
                .frame(height: 120)
            }
            if let alt = m.altitudeKm {
                let base = (alt.min() ?? 0)
                Text("Altitude em relação à largada (m)").font(.caption).foregroundStyle(Tema.textoSuave)
                Chart {
                    ForEach(alt.indices, id: \.self) { i in
                        AreaMark(x: .value("km", i + 1), yStart: .value("base", base - 5), yEnd: .value("m", alt[i]))
                            .foregroundStyle(Tema.roxo.opacity(0.3)).interpolationMethod(.monotone)
                    }
                    if let k { RuleMark(x: .value("km", k)).foregroundStyle(Tema.texto.opacity(0.3)) }
                }
                .chartYScale(domain: (base - 5)...max((alt.max() ?? 0) + 5, base + 30))
                .chartYAxis { eixoInteiro }
                .modifier(EixoKm(toque: $toque))
                .frame(height: 100)
            }
        }
    }

    private var eixoInteiro: some AxisContent {
        AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) { v in
            AxisGridLine()
            AxisValueLabel { if let d = v.as(Double.self) { Text("\(Int(d))").font(.caption2).frame(width: 34, alignment: .trailing) } }
        }
    }
}

/// Os três gráficos dividem o mesmo eixo de km e o mesmo toque.
private struct EixoKm: ViewModifier {
    @Binding var toque: Int?
    func body(content: Content) -> some View {
        content
            .chartXScale(domain: 0...43)
            .chartXAxis { AxisMarks(values: [5, 10, 15, 21, 25, 30, 35, 42]) { _ in AxisGridLine(); AxisValueLabel() } }
            .chartXSelection(value: $toque)
    }
}

private struct ContraRecorde: View {
    let m: Maratona
    let melhor: Maratona

    var body: some View {
        let difs = (1...42).map { (km: $0, min: (m.tempo(noKm: Double($0)) - melhor.tempo(noKm: Double($0))) / 60) }
        let ultimoAFrente = difs.last { $0.min <= 0 }?.km
        Secao(titulo: "Contra o recorde", icone: "trophy.fill", tom: Tema.ouro) {
            Chart {
                ForEach(difs, id: \.km) { d in
                    AreaMark(x: .value("km", d.km), y: .value("min", -d.min)).foregroundStyle(Tema.ouro.opacity(0.25))
                    LineMark(x: .value("km", d.km), y: .value("min", -d.min)).foregroundStyle(Tema.ouro)
                }
                RuleMark(y: .value("recorde", 0.0)).foregroundStyle(Tema.texto.opacity(0.5))
            }
            .chartYAxis {
                AxisMarks(position: .leading) { v in
                    AxisGridLine()
                    AxisValueLabel { if let d = v.as(Double.self) { Text("\(d > 0 ? "+" : "")\(Int(d)) min").font(.caption2) } }
                }
            }
            .chartXAxis { AxisMarks(values: [5, 10, 15, 21, 25, 30, 35, 42]) { _ in AxisGridLine(); AxisValueLabel() } }
            .frame(height: 150)
            Text(ultimoAFrente.map { $0 >= 2 ? "Esteve à frente ou junto do ritmo de \(melhor.rotulo) até o km \($0)." : "Ficou atrás de \(melhor.rotulo) desde o começo." }
                ?? "Ficou atrás de \(melhor.rotulo) desde o começo.")
                .font(.footnote).foregroundStyle(Tema.textoSuave)
            Text("Acima da linha = à frente do recorde naquele km.").font(.caption2).foregroundStyle(Tema.textoSuave)
        }
    }
}

private struct Parciais: View {
    let m: Maratona

    var body: some View {
        let marcas: [(String, Double)] = [("5 km", 5), ("10 km", 10), ("15 km", 15), ("20 km", 20), ("Meia", 21.0975), ("25 km", 25), ("30 km", 30), ("35 km", 35), ("40 km", 40), ("Chegada", Maratona.distanciaKm)]
        Secao(titulo: "Parciais", icone: "timer", tom: Tema.azul) {
            Grid(alignment: .trailing, verticalSpacing: 8) {
                GridRow {
                    Text("").gridColumnAlignment(.leading)
                    Text("Tempo"); Text("Trecho /km"); Text("Projeção")
                }
                .font(.caption).foregroundStyle(Tema.textoSuave)
                ForEach(marcas.indices, id: \.self) { i in
                    let (nome, km) = marcas[i]
                    let t = m.tempo(noKm: km)
                    let kmAntes = i == 0 ? 0 : marcas[i - 1].1
                    let pace = (t - m.tempo(noKm: kmAntes)) / (km - kmAntes)
                    Divider()
                    GridRow {
                        Text(nome).font(.footnote.weight(.semibold))
                        Text(formatarDuracao(t)).font(.footnote.weight(.semibold))
                        HStack(spacing: 5) {
                            Circle().fill(corDoPace((pace - 305) / 175)).frame(width: 8, height: 8)
                            Text(formatarPace(pace)).font(.footnote)
                        }
                        Text(formatarDuracao(t / km * Maratona.distanciaKm)).font(.footnote).foregroundStyle(Tema.textoSuave)
                    }
                    .monospacedDigit()
                    .frame(maxWidth: .infinity)
                }
            }
            Text("Parciais do GPS ajustadas para 42,195 km e o tempo final. Projeção = o tempo final se mantivesse a média até ali.").font(.caption2).foregroundStyle(Tema.textoSuave)
        }
    }
}

private struct BlocoPreparo: View {
    let p: Maratona.Preparo

    var body: some View {
        Secao(titulo: "Como você chegou lá", icone: "calendar", tom: Tema.aqua) {
            HStack {
                item("\(Int(p.km))", "km em 16 sem")
                item("\(p.corridas)", "corridas")
                item(numeroBR(p.longaoKm), "maior longão")
                item("\(p.longoes30)", "de 30+ km")
            }
            Chart(p.semanasKm.indices, id: \.self) { i in
                BarMark(x: .value("Semana", i - p.semanasKm.count), y: .value("km", p.semanasKm[i]))
                    .foregroundStyle(i >= p.semanasKm.count - 2 ? Tema.ouro : Tema.aqua)
                    .cornerRadius(4)
            }
            .chartXScale(domain: -17...0)
            .chartXAxis { AxisMarks(values: [-16, -12, -8, -4, -1]) { _ in AxisValueLabel() } }
            .frame(height: 140)
            Text("Km por semana até a prova (semanas antes). Em dourado, as duas últimas.").font(.caption2).foregroundStyle(Tema.textoSuave)
        }
    }

    private func item(_ v: String, _ t: String) -> some View {
        VStack(spacing: 1) {
            Text(v).font(.title3.weight(.heavy)).foregroundStyle(Tema.texto)
            Text(t).font(.caption2).foregroundStyle(Tema.textoSuave).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }
}
