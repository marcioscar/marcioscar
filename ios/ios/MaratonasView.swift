import Charts
import MapKit
import SwiftUI

private let ptBR = Locale(identifier: "pt_BR")

// MARK: - Aba Maratonas

struct MaratonasView: View {
    @State private var store = MaratonasStore()
    @State private var selecionada: String?
    @State private var detalhe: Maratona?
    @State private var globoCheio = false
    @Environment(\.scenePhase) private var fase
    var ajustes: () -> Void

    var body: some View {
        ScrollViewReader { rolagem in
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    cabecalho
                    if let erro = store.erro {
                        Label(erro, systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote)
                            .foregroundStyle(Color.orange)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
                    }
                    if let p = store.painel, let melhor = store.melhor {
                        PainelTotais(store: store, melhor: melhor)
                        GloboMaratonas(store: store, selecionada: $selecionada, abrir: { detalhe = $0 }, ampliar: { globoCheio = true })
                            .frame(height: 430)
                            .clipShape(RoundedRectangle(cornerRadius: 22))
                            .id("globo")
                        Passaporte(store: store) { m in
                            selecionada = m.id
                            withAnimation { rolagem.scrollTo("globo", anchor: .top) }
                        }
                        BlocoMeta(p: p, melhor: melhor)
                        GraficoTempos(store: store, abrir: { detalhe = $0 })
                        BlocoRecordes(store: store, abrir: { detalhe = $0 })
                        MapaDeCalor(todas: store.todas, abrir: { detalhe = $0 })
                        BlocoMetades(todas: store.todas)
                        Comparador(todas: store.todas, melhor: melhor)
                        CorridaFantasma(todas: store.todas)
                        GraficoPreparo(todas: store.todas)
                        ListaMaratonas(store: store, abrir: { detalhe = $0 })
                    } else if store.carregando {
                        ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                    } else if store.painel != nil {
                        Text("Nenhuma maratona ainda.").foregroundStyle(Tema.textoSuave)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 32)
            }
        }
        .background(FundoColorido())
        .refreshable { await store.carregar() }
        .toolbar(.hidden, for: .navigationBar)
        .navigationDestination(item: $detalhe) { MaratonaDetalheView(m: $0, store: store) }
        .fullScreenCover(isPresented: $globoCheio) {
            GloboCheio(store: store, selecionada: $selecionada) { m in
                globoCheio = false
                detalhe = m
            }
        }
        .task { await store.carregar() }
        .onChange(of: fase) { _, nova in
            if nova == .active { Task { await store.carregar() } }
        }
    }

    private var cabecalho: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
                Text("42,195 km pelo mundo").font(.subheadline).foregroundStyle(Tema.textoSuave)
                Text("Maratonas").font(.system(size: 40, weight: .heavy)).foregroundStyle(Tema.texto)
            }
            Spacer()
            Button(action: ajustes) {
                Image(systemName: "gearshape")
                    .font(.title3)
                    .foregroundStyle(Tema.texto)
                    .frame(width: 46, height: 46)
                    .background(Tema.cartao, in: Circle())
                    .overlay(Circle().stroke(Tema.linha, lineWidth: 1))
            }
            .accessibilityLabel("Ajustes")
        }
        .padding(.top, 8)
    }
}

// MARK: - Totais

private struct PainelTotais: View {
    let store: MaratonasStore
    let melhor: Maratona

    var body: some View {
        let todas = store.todas
        let horas = todas.reduce(0) { $0 + $1.tempoSeg }
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .lastTextBaseline, spacing: 10) {
                Text("\(todas.count)").font(.system(size: 64, weight: .heavy)).foregroundStyle(Tema.ouro)
                VStack(alignment: .leading, spacing: 0) {
                    Text("maratonas").font(.title2.weight(.heavy)).foregroundStyle(.white)
                    if let a = todas.first?.ano, let b = todas.last?.ano {
                        Text("de \(a) a \(b)").font(.subheadline).foregroundStyle(.white.opacity(0.65))
                    }
                }
                Spacer(minLength: 0)
                Image(systemName: "medal.fill").font(.system(size: 40)).foregroundStyle(Tema.ouro.gradient)
            }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 14) {
                TotalColorido(titulo: "Recorde · \(melhor.local)", valor: formatarDuracao(melhor.tempoSeg), icone: "trophy.fill", cor: Tema.ouro)
                TotalColorido(titulo: "Países", valor: "\(store.paises.count)", icone: "globe.americas.fill", cor: Tema.azul)
                TotalColorido(titulo: "Km em provas", valor: "\(Int(Double(todas.count) * Maratona.distanciaKm)) km", icone: "figure.run", cor: Tema.aqua)
                TotalColorido(titulo: "Tempo correndo", valor: formatarDuracaoLonga(horas), icone: "stopwatch.fill", cor: Tema.roxo)
                TotalColorido(titulo: "Média", valor: formatarDuracao(horas / Double(max(todas.count, 1))), icone: "equal", cor: Tema.laranja)
                TotalColorido(titulo: "Abaixo de 4 h", valor: "\(todas.filter { $0.tempoSeg < 14_400 }.count) provas", icone: "bolt.fill", cor: Tema.vermelho)
            }
        }
        .padding(18)
        .background(escuroProva, in: RoundedRectangle(cornerRadius: 22))
    }
}

// MARK: - Globo

private struct GloboMaratonas: View {
    let store: MaratonasStore
    @Binding var selecionada: String?
    var abrir: (Maratona) -> Void
    var ampliar: (() -> Void)?

    @State private var camera: MapCameraPosition = .camera(Self.mundo)
    @State private var satelite = true
    @State private var passeio: Task<Void, Never>?

    private static let mundo = MapCamera(centerCoordinate: CLLocationCoordinate2D(latitude: 8, longitude: -50), distance: 26_000_000)

    private var atual: Maratona? { store.todas.first { $0.id == selecionada } }

    var body: some View {
        Map(position: $camera) {
            ForEach(Array(zip(store.todas, store.todas.dropFirst())), id: \.0.id) { a, b in
                if let pa = store.pontos[a.id], let pb = store.pontos[b.id] {
                    MapPolyline(coordinates: [pa, pb], contourStyle: .geodesic)
                        .stroke(Tema.lima.opacity(selecionada == nil ? 0.7 : 0.25), style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
                }
            }
            if let m = atual, let c = store.rotas[m.id] {
                MapPolyline(coordinates: c).stroke(.white, lineWidth: 7)
                MapPolyline(coordinates: c).stroke(Tema.laranja, lineWidth: 4)
            }
            ForEach(store.todas) { m in
                if let p = store.pontos[m.id] {
                    Annotation(m.local, coordinate: p) {
                        Button { passeio?.cancel(); passeio = nil; selecionada = m.id } label: {
                            Pino(m: m, ativo: m.id == selecionada, recorde: m.id == store.melhor?.id)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(m.nome), \(m.ano)")
                    }
                    .annotationTitles(m.id == selecionada ? .hidden : .automatic)
                }
            }
        }
        .mapStyle(satelite ? .imagery(elevation: .realistic) : .standard(elevation: .realistic, pointsOfInterest: .excludingAll))
        .mapControls {}
        .overlay(alignment: .topTrailing) { botoes }
        .overlay(alignment: .bottom) { rodape }
        .onAppear { if let m = atual { voar(m) } }
        .onChange(of: selecionada) { _, _ in
            if let m = atual { voar(m) } else {
                withAnimation(.easeInOut(duration: 1.6)) { camera = .camera(Self.mundo) }
            }
        }
        .onDisappear { passeio?.cancel(); passeio = nil }
    }

    private var botoes: some View {
        VStack(spacing: 8) {
            if let ampliar { BotaoMapa(icone: "arrow.up.left.and.arrow.down.right", rotulo: "Tela cheia", acao: ampliar) }
            BotaoMapa(icone: satelite ? "map.fill" : "globe.americas.fill", rotulo: "Trocar mapa") { satelite.toggle() }
            BotaoMapa(icone: passeio == nil ? "play.fill" : "pause.fill", rotulo: "Passeio pelas provas", acao: alternarPasseio)
            if selecionada != nil {
                BotaoMapa(icone: "globe", rotulo: "Ver o mundo") { parar(); selecionada = nil }
            }
        }
        .padding(12)
        .padding(.top, ampliar == nil ? 52 : 0)
    }

    @ViewBuilder private var rodape: some View {
        if let m = atual {
            HStack(spacing: 10) {
                Button { parar(); andar(-1) } label: { Image(systemName: "chevron.left").font(.headline).frame(width: 34, height: 44) }
                    .accessibilityLabel("Prova anterior")
                Button { parar(); abrir(m) } label: {
                    HStack(spacing: 10) {
                        Text(m.bandeira).font(.title)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(m.nome).font(.subheadline.weight(.bold)).lineLimit(1)
                            Text("\(m.numero)ª · \(m.dataLonga)").font(.caption).foregroundStyle(Tema.textoSuave).lineLimit(1).minimumScaleFactor(0.8)
                            Text("\(formatarDuracao(m.tempoSeg)) · \(formatarPace(m.paceSeg))/km").font(.caption.weight(.semibold)).monospacedDigit()
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "arrow.right.circle.fill").font(.title2).foregroundStyle(Tema.laranja)
                    }
                }
                Button { parar(); andar(1) } label: { Image(systemName: "chevron.right").font(.headline).frame(width: 34, height: 44) }
                    .accessibilityLabel("Próxima prova")
            }
            .buttonStyle(.plain)
            .foregroundStyle(Tema.texto)
            .padding(8)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18))
            .padding(10)
        } else {
            Text("Toque numa bandeira ou em ▶ para o passeio")
                .font(.caption.weight(.medium))
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(.regularMaterial, in: Capsule())
                .padding(.bottom, 14)
        }
    }

    private func voar(_ m: Maratona) {
        guard let p = store.pontos[m.id] else { return }
        var centro = p
        var distancia = 45_000.0
        if let c = store.rotas[m.id] {
            let lats = c.map(\.latitude), lngs = c.map(\.longitude)
            centro = CLLocationCoordinate2D(latitude: (lats.min()! + lats.max()!) / 2, longitude: (lngs.min()! + lngs.max()!) / 2)
            let diagonal = CLLocation(latitude: lats.min()!, longitude: lngs.min()!).distance(from: CLLocation(latitude: lats.max()!, longitude: lngs.max()!))
            distancia = max(diagonal * 2.9, 12_000)
        }
        withAnimation(.easeInOut(duration: 2)) {
            camera = .camera(MapCamera(centerCoordinate: centro, distance: distancia, heading: 0, pitch: 35))
        }
    }

    private func andar(_ passo: Int) {
        let l = store.todas
        guard !l.isEmpty else { return }
        let i = l.firstIndex { $0.id == selecionada } ?? (passo > 0 ? -1 : 0)
        selecionada = l[(i + passo + l.count) % l.count].id
    }

    private func parar() { passeio?.cancel(); passeio = nil }

    private func alternarPasseio() {
        if passeio != nil { parar(); return }
        let ordem = store.todas
        let comeco = ordem.firstIndex { $0.id == selecionada }.map { $0 + 1 < ordem.count ? $0 + 1 : 0 } ?? 0
        passeio = Task {
            for m in ordem[comeco...] {
                selecionada = m.id
                try? await Task.sleep(for: .seconds(5))
                if Task.isCancelled { return }
            }
            selecionada = nil
            passeio = nil
        }
    }
}

private struct Pino: View {
    let m: Maratona
    let ativo: Bool
    let recorde: Bool
    var body: some View {
        Text(m.bandeira)
            .font(.system(size: ativo ? 24 : 16))
            .frame(width: ativo ? 44 : 30, height: ativo ? 44 : 30)
            .background(.white, in: Circle())
            .overlay(Circle().stroke(recorde ? Tema.ouro : (ativo ? Tema.laranja : .white), lineWidth: recorde || ativo ? 3 : 1))
            .shadow(color: .black.opacity(0.35), radius: 3, y: 1)
            .overlay(alignment: .topTrailing) {
                if recorde {
                    Image(systemName: "star.fill").font(.system(size: 9)).foregroundStyle(.white)
                        .padding(3).background(Tema.ouro, in: Circle()).offset(x: 5, y: -5)
                }
            }
    }
}

private struct BotaoMapa: View {
    let icone: String
    let rotulo: String
    var acao: () -> Void
    var body: some View {
        Button(action: acao) {
            Image(systemName: icone)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Tema.texto)
                .frame(width: 44, height: 44)
                .background(.regularMaterial, in: Circle())
        }
        .accessibilityLabel(rotulo)
    }
}

private struct GloboCheio: View {
    let store: MaratonasStore
    @Binding var selecionada: String?
    var abrir: (Maratona) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        GloboMaratonas(store: store, selecionada: $selecionada, abrir: abrir, ampliar: nil)
            .overlay(alignment: .topTrailing) {
                BotaoMapa(icone: "xmark", rotulo: "Fechar mapa") { dismiss() }.padding(12)
            }
            .background(.black)
            .preferredColorScheme(.light)
    }
}

// MARK: - Passaporte

private struct Passaporte: View {
    let store: MaratonasStore
    var escolher: (Maratona) -> Void
    /// toques seguidos no mesmo país passam de prova em prova
    @State private var vez: [String: Int] = [:]

    var body: some View {
        Secao(titulo: "Passaporte", icone: "globe.americas.fill", tom: Tema.azul) {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 92), spacing: 8)], spacing: 8) {
                ForEach(store.paises, id: \.codigo) { p in
                    Button {
                        let i = vez[p.codigo, default: 0] % p.provas.count
                        vez[p.codigo] = i + 1
                        escolher(p.provas[i])
                    } label: {
                        VStack(spacing: 2) {
                            Text(p.bandeira).font(.system(size: 34))
                            Text(p.nome).font(.caption.weight(.bold)).foregroundStyle(Tema.texto).lineLimit(1).minimumScaleFactor(0.7)
                            Text("\(p.provas.count) \(p.provas.count == 1 ? "prova" : "provas")").font(.caption2).foregroundStyle(Tema.textoSuave)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Tema.fundo, in: RoundedRectangle(cornerRadius: 14))
                    }
                    .buttonStyle(.plain)
                }
            }
            Text("Toque num país para o mapa voar até lá.").font(.caption).foregroundStyle(Tema.textoSuave)
        }
    }
}

// MARK: - Próxima / meta

private struct BlocoMeta: View {
    let p: PainelMaratonas
    let melhor: Maratona

    var body: some View {
        let ganho = melhor.tempoSeg - p.previsaoSeg
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "flag.checkered").font(.headline)
                if let prox = p.proxima, let d = Maratona.dia(prox.data) {
                    let dias = Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: .now), to: d).day ?? 0
                    Text("\(prox.nome) · faltam \(max(dias, 0)) dias").font(.headline)
                } else {
                    Text("E a próxima?").font(.headline)
                }
            }
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(formatarDuracao(p.previsaoSeg)).font(.system(size: 38, weight: .heavy)).monospacedDigit()
                Text("\(formatarPace(p.previsaoSeg / Maratona.distanciaKm))/km").font(.headline).foregroundStyle(Tema.texto.opacity(0.65))
            }
            Text(ganho > 0
                ? "É o que o seu VPONTO atual (\(numeroBR(p.vpontoAtual))) indica hoje: \(formatarDuracao(ganho)) abaixo do recorde de \(melhor.rotulo)."
                : "É o que o seu VPONTO atual (\(numeroBR(p.vpontoAtual))) indica hoje: \(formatarDuracao(-ganho)) acima do recorde de \(melhor.rotulo).")
                .font(.footnote)
                .foregroundStyle(Tema.texto.opacity(0.75))
            Text("Previsão de laboratório: supõe um ciclo completo de maratona. O recorde veio com VPONTO \(numeroBR(melhor.vponto)) na prova.")
                .font(.caption)
                .foregroundStyle(Tema.texto.opacity(0.6))
        }
        .foregroundStyle(Tema.texto)
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LinearGradient(colors: [Tema.lima, Tema.lima.opacity(0.55)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 20))
    }
}

func numeroBR(_ v: Double) -> String {
    v.formatted(.number.precision(.fractionLength(0...1)).locale(Locale(identifier: "pt_BR")))
}

// MARK: - Evolução

private struct GraficoTempos: View {
    enum Medida: String, CaseIterable { case tempo = "Tempo", vponto = "VPONTO", fc = "FC média" }
    let store: MaratonasStore
    var abrir: (Maratona) -> Void
    @State private var medida: Medida = .tempo
    @State private var toque: Date?

    private func valor(_ m: Maratona) -> Double? {
        switch medida {
        case .tempo: m.tempoSeg
        case .vponto: m.vponto
        case .fc: m.fcMedia
        }
    }
    private func texto(_ v: Double) -> String {
        switch medida {
        case .tempo: formatarDuracao(v)
        case .vponto: numeroBR(v)
        case .fc: "\(Int(v.rounded())) bpm"
        }
    }

    var body: some View {
        let dados = store.todas.filter { valor($0) != nil }
        let recordes = store.recordes
        let escolhida = toque.flatMap { t in dados.min { abs($0.dataReal.timeIntervalSince(t)) < abs($1.dataReal.timeIntervalSince(t)) } }
        let valores = dados.compactMap { valor($0) }
        let folga = medida == .tempo ? 420.0 : 2.0
        let dominio = [(valores.min() ?? 0) - folga, (valores.max() ?? 1) + folga]

        Secao(titulo: "Evolução", icone: "chart.line.uptrend.xyaxis", tom: Tema.aqua) {
            Picker("Medida", selection: $medida) { ForEach(Medida.allCases, id: \.self) { Text($0.rawValue) } }
                .pickerStyle(.segmented)
            HStack {
                if let e = escolhida, let v = valor(e) {
                    Text("\(e.bandeira) \(e.rotulo)").font(.subheadline.weight(.bold))
                    Spacer()
                    Text(texto(v)).font(.subheadline.weight(.bold)).monospacedDigit()
                } else {
                    Text(medida == .tempo ? "Mais alto = mais rápido" : "Arraste para ver cada prova").font(.caption).foregroundStyle(Tema.textoSuave)
                }
            }
            .frame(height: 20)
            Chart {
                if medida == .tempo {
                    RuleMark(y: .value("4 h", 14_400.0))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4])).foregroundStyle(Tema.vermelho.opacity(0.7))
                        .annotation(position: .top, alignment: .leading) { Text("4 h").font(.caption2.bold()).foregroundStyle(Tema.vermelho) }
                }
                ForEach(dados) { m in
                    LineMark(x: .value("Data", m.dataReal), y: .value("Valor", valor(m) ?? 0))
                        .foregroundStyle(Tema.aqua.opacity(0.6))
                        .interpolationMethod(.monotone)
                }
                ForEach(dados) { m in
                    let pr = medida == .tempo && recordes.contains(m.id)
                    PointMark(x: .value("Data", m.dataReal), y: .value("Valor", valor(m) ?? 0))
                        .foregroundStyle(pr ? Tema.ouro : Tema.aqua)
                        .symbolSize(pr ? 130 : 60)
                }
                if let e = escolhida {
                    RuleMark(x: .value("Data", e.dataReal)).foregroundStyle(Tema.texto.opacity(0.35))
                }
            }
            .modifier(EscalaY(dominio: dominio, invertida: medida == .tempo))
            .chartYAxis {
                AxisMarks(position: .leading, values: .automatic(desiredCount: 5)) { v in
                    AxisGridLine()
                    AxisValueLabel {
                        if let d = v.as(Double.self) { Text(medida == .tempo ? formatarHorasMin(d) : "\(Int(d))").font(.caption2) }
                    }
                }
            }
            .chartXAxis {
                AxisMarks(values: .stride(by: .year, count: 3)) { _ in
                    AxisGridLine()
                    AxisValueLabel(format: .dateTime.year())
                }
            }
            .chartXSelection(value: $toque)
            .frame(height: 220)
            if medida == .tempo {
                Label("Em dourado, recorde pessoal no dia da prova", systemImage: "circle.fill")
                    .font(.caption).foregroundStyle(Tema.ouro)
            } else if medida == .fc {
                Text("FC registrada desde 2017.").font(.caption).foregroundStyle(Tema.textoSuave)
            }
        }
    }
}

private struct EscalaY: ViewModifier {
    let dominio: [Double]
    let invertida: Bool
    func body(content: Content) -> some View {
        content.chartYScale(domain: invertida ? dominio.reversed() : dominio)
    }
}

// MARK: - Recordes e curiosidades

private struct BlocoRecordes: View {
    let store: MaratonasStore
    var abrir: (Maratona) -> Void

    private struct Item: Identifiable {
        let id: String
        let icone: String
        let cor: Color
        let m: Maratona
        let valor: String
    }

    private var itens: [Item] {
        let l = store.todas
        var s: [Item] = []
        func add(_ titulo: String, _ icone: String, _ cor: Color, _ m: Maratona?, _ valor: (Maratona) -> String) {
            if let m { s.append(Item(id: titulo, icone: icone, cor: cor, m: m, valor: valor(m))) }
        }
        add("Mais rápida", "trophy.fill", Tema.ouro, store.melhor) { formatarDuracao($0.tempoSeg) }
        add("Melhor 1ª metade", "hare.fill", Tema.laranja, l.filter { $0.leitura != nil }.min { $0.leitura!.primeiraMetadeSeg < $1.leitura!.primeiraMetadeSeg }) { formatarDuracao($0.leitura!.primeiraMetadeSeg) }
        add("Mais regular", "equal.circle.fill", Tema.aqua, l.filter { $0.leitura != nil }.min { abs($0.leitura!.diferencaSeg) < abs($1.leitura!.diferencaSeg) }) { formatarDiferenca($0.leitura!.diferencaSeg) + " na 2ª metade" }
        add("Maior quebra", "tortoise.fill", Tema.vermelho, l.filter { $0.leitura != nil }.max { $0.leitura!.diferencaSeg < $1.leitura!.diferencaSeg }) { formatarDiferenca($0.leitura!.diferencaSeg) + " na 2ª metade" }
        add("Mais subida", "mountain.2.fill", Tema.roxo, l.filter { $0.elevacaoM != nil }.max { $0.elevacaoM! < $1.elevacaoM! }) { "\(Int($0.elevacaoM!)) m" }
        add("Mais plana", "road.lanes", Tema.azul, l.filter { $0.elevacaoM != nil }.min { $0.elevacaoM! < $1.elevacaoM! }) { "\(Int($0.elevacaoM!)) m" }
        let temp = l.filter { $0.temperatura != nil }
        if temp.count > 1 {
            add("Mais quente", "sun.max.fill", Tema.laranja, temp.max { $0.temperatura! < $1.temperatura! }) { "\(Int($0.temperatura!))°C" }
            add("Mais fria", "snowflake", Tema.azul, temp.min { $0.temperatura! < $1.temperatura! }) { "\(Int($0.temperatura!))°C" }
        }
        add("Coração mais alto", "heart.fill", Tema.vermelho, l.filter { $0.fcMedia != nil }.max { $0.fcMedia! < $1.fcMedia! }) { "\(Int($0.fcMedia!.rounded())) bpm" }
        add("Melhor preparada", "calendar", Tema.aqua, l.filter { $0.preparo != nil }.max { $0.preparo!.km < $1.preparo!.km }) { "\(Int($0.preparo!.km)) km em 16 sem" }
        return s
    }

    var body: some View {
        Secao(titulo: "Recordes e curiosidades", icone: "star.fill", tom: Tema.ouro) {
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                ForEach(itens) { i in
                    Button { abrir(i.m) } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 6) {
                                Image(systemName: i.icone).font(.caption.weight(.bold)).foregroundStyle(i.cor)
                                Text(i.id).font(.caption.weight(.medium)).foregroundStyle(Tema.textoSuave)
                            }
                            Text(i.valor).font(.subheadline.weight(.heavy)).foregroundStyle(Tema.texto).lineLimit(1).minimumScaleFactor(0.7)
                            Text("\(i.m.bandeira) \(i.m.rotulo)").font(.caption).foregroundStyle(Tema.texto).lineLimit(1).minimumScaleFactor(0.7)
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(i.cor.opacity(0.10), in: RoundedRectangle(cornerRadius: 14))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

// MARK: - Mapa de calor

/// Cada linha é uma prova, cada quadradinho é um km: dá para ver o muro chegando.
private struct MapaDeCalor: View {
    let todas: [Maratona]
    var abrir: (Maratona) -> Void

    /// mesma escala para todas as provas
    private static let rapido = 305.0
    private static let lento = 480.0

    var body: some View {
        let provas = todas.filter { $0.pacesKm != nil }.reversed()
        Secao(titulo: "O muro, km a km", icone: "square.grid.3x3.fill", tom: Tema.laranja) {
            Text("Cada linha é uma prova e cada coluna, um km. Toque na linha para abrir a prova.").font(.caption).foregroundStyle(Tema.textoSuave)
            VStack(spacing: 4) {
                ForEach(Array(provas)) { m in
                    Button { abrir(m) } label: {
                        HStack(spacing: 8) {
                            Text("\(m.bandeira) \(m.rotuloCurto)").font(.caption.weight(.medium)).foregroundStyle(Tema.texto)
                                .lineLimit(1).minimumScaleFactor(0.7).frame(width: 104, alignment: .leading)
                            Canvas { ctx, tam in
                                guard let p = m.pacesKm else { return }
                                let w = tam.width / CGFloat(p.count)
                                for (i, v) in p.enumerated() {
                                    let x = (v - Self.rapido) / (Self.lento - Self.rapido)
                                    ctx.fill(Path(CGRect(x: CGFloat(i) * w, y: 0, width: w - 0.6, height: tam.height)), with: .color(corDoPace(x)))
                                }
                            }
                            .frame(height: 22)
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                        }
                    }
                    .buttonStyle(.plain)
                }
                HStack(spacing: 8) {
                    Color.clear.frame(width: 104, height: 1)
                    HStack { Text("km 1"); Spacer(); Text("21"); Spacer(); Text("42") }
                        .font(.caption2).foregroundStyle(Tema.textoSuave)
                }
            }
            LegendaRitmo(rapido: Self.rapido, lento: Self.lento)
            Text("Chicago fica de fora: o GPS se perdeu entre os prédios. Até 2014 (Rio) só há o tempo final.").font(.caption2).foregroundStyle(Tema.textoSuave)
        }
    }
}

// MARK: - Metades

private struct BlocoMetades: View {
    let todas: [Maratona]

    var body: some View {
        let provas = todas.filter { $0.leitura != nil }
        Secao(titulo: "Primeira × segunda metade", icone: "circle.lefthalf.filled", tom: Tema.roxo) {
            Chart(provas) { m in
                let d = (m.leitura?.diferencaSeg ?? 0) / 60
                BarMark(x: .value("Minutos", d), y: .value("Prova", m.rotuloCurto))
                    .foregroundStyle(d < 4 ? Tema.aqua : (d < 20 ? Tema.ouro : Tema.vermelho))
                    .cornerRadius(5)
                    .annotation(position: .trailing) {
                        Text(formatarDiferenca(m.leitura?.diferencaSeg ?? 0)).font(.caption2.weight(.bold)).monospacedDigit().foregroundStyle(Tema.texto)
                    }
            }
            .chartXScale(domain: min(0, (provas.map { $0.leitura!.diferencaSeg }.min() ?? 0) / 60)...max(50, (provas.map { $0.leitura!.diferencaSeg }.max() ?? 0) / 60 * 1.3))
            .chartXAxis(.hidden)
            .chartYAxis { AxisMarks(position: .leading) { _ in AxisValueLabel().font(.caption) } }
            .frame(height: CGFloat(provas.count) * 32 + 10)
            let quedas = provas.compactMap { $0.leitura?.kmQueda }.sorted()
            if !quedas.isEmpty {
                Text("Minutos a mais na segunda metade. Em \(quedas.count) de \(provas.count) provas o ritmo caiu e não voltou, tipicamente no km \(quedas[quedas.count / 2]).")
                    .font(.footnote).foregroundStyle(Tema.textoSuave)
            }
        }
    }
}

// MARK: - Comparador

private struct Comparador: View {
    enum Visao: String, CaseIterable { case ritmo = "Ritmo", diferenca = "Diferença", fc = "FC" }
    struct Ponto: Identifiable {
        let km: Int
        let valor: Double
        let serie: String
        var id: String { "\(serie)-\(km)" }
    }

    let todas: [Maratona]
    let melhor: Maratona
    @State private var ids: [String] = []
    @State private var visao: Visao = .ritmo
    @State private var toque: Int?

    private static let cores: [Color] = [Tema.azul, Tema.laranja, Tema.roxo]

    private var opcoes: [Maratona] { todas.filter(\.temParciais).reversed() }
    private var escolhidas: [Maratona] { ids.compactMap { id in opcoes.first { $0.id == id } } }

    private func serie(_ m: Maratona) -> [Ponto] {
        switch visao {
        case .ritmo:
            let p = m.pacesKm ?? []
            // média de 3 km: o GPS oscila de um km para o outro
            return p.indices.map { i in
                let j = p[max(0, i - 1)...min(p.count - 1, i + 1)]
                return Ponto(km: i + 1, valor: j.reduce(0, +) / Double(j.count), serie: m.id)
            }
        case .diferenca:
            guard let ref = escolhidas.first?.tempoKm, let t = m.tempoKm else { return [] }
            return t.indices.map { Ponto(km: $0 + 1, valor: (t[$0] - ref[$0]) / 60, serie: m.id) }
        case .fc:
            return (m.fcKm ?? []).enumerated().compactMap { i, v in v.map { Ponto(km: i + 1, valor: $0, serie: m.id) } }
        }
    }

    private func texto(_ v: Double) -> String {
        switch visao {
        case .ritmo: formatarPace(v)
        case .diferenca: formatarDiferenca(v * 60)
        case .fc: "\(Int(v.rounded()))"
        }
    }

    var body: some View {
        Secao(titulo: "Frente a frente", icone: "arrow.left.arrow.right", tom: Tema.azul) {
            Text("Escolha até 3 provas. A primeira é a referência.").font(.caption).foregroundStyle(Tema.textoSuave)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(opcoes) { m in
                        let i = ids.firstIndex(of: m.id)
                        Button { alternar(m.id) } label: {
                            Text("\(m.bandeira) \(m.rotuloCurto)")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(i == nil ? Tema.texto : .white)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 9)
                                .background(i.map { Self.cores[$0] } ?? Tema.fundo, in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(i == nil ? [] : .isSelected)
                    }
                }
            }
            Picker("Visão", selection: $visao) { ForEach(Visao.allCases, id: \.self) { Text($0.rawValue) } }.pickerStyle(.segmented)
            grafico
            tabela
        }
        .onAppear {
            if ids.isEmpty {
                let outra = opcoes.first { $0.id != melhor.id }
                ids = [opcoes.contains { $0.id == melhor.id } ? melhor.id : nil, outra?.id].compactMap { $0 }
            }
        }
    }

    private func alternar(_ id: String) {
        if let i = ids.firstIndex(of: id) {
            if ids.count > 1 { ids.remove(at: i) }
        } else {
            if ids.count == 3 { ids.removeLast() }
            ids.append(id)
        }
    }

    @ViewBuilder private var grafico: some View {
        let sel = escolhidas
        let pontos = sel.flatMap { serie($0) }
        if pontos.isEmpty {
            Text(visao == .fc ? "Sem FC nestas provas." : "Sem parciais.").font(.footnote).foregroundStyle(Tema.textoSuave).frame(height: 80)
        } else {
            let vals = pontos.map(\.valor)
            let lo = vals.min()! - (visao == .ritmo ? 10 : 2), hi = vals.max()! + (visao == .ritmo ? 10 : 2)
            Chart {
                if visao == .diferenca { RuleMark(y: .value("Referência", 0.0)).foregroundStyle(Tema.texto.opacity(0.3)) }
                ForEach(pontos) { p in
                    LineMark(x: .value("km", p.km), y: .value("Valor", p.valor), series: .value("Prova", p.serie))
                        .foregroundStyle(cor(p.serie))
                        .lineStyle(StrokeStyle(lineWidth: 2.5))
                        .interpolationMethod(.monotone)
                }
                if let k = toque.map({ min(42, max(1, $0)) }) {
                    RuleMark(x: .value("km", k))
                        .foregroundStyle(Tema.texto.opacity(0.4))
                        .annotation(position: .top, overflowResolution: .init(x: .fit(to: .chart), y: .disabled)) {
                            HStack(spacing: 8) {
                                Text("km \(k)").bold()
                                ForEach(sel) { m in
                                    if let p = pontos.first(where: { $0.serie == m.id && $0.km == k }) {
                                        Text(texto(p.valor)).bold().foregroundStyle(cor(m.id)).monospacedDigit()
                                    }
                                }
                            }
                            .font(.caption)
                            .padding(6)
                            .background(.white, in: RoundedRectangle(cornerRadius: 8))
                            .shadow(radius: 2)
                        }
                }
            }
            .modifier(EscalaY(dominio: [lo, hi], invertida: visao != .fc))
            .chartXScale(domain: 1...42)
            .chartXAxis { AxisMarks(values: [5, 10, 15, 21, 25, 30, 35, 42]) { _ in AxisGridLine(); AxisValueLabel() } }
            .chartYAxis {
                AxisMarks(position: .leading, values: .automatic(desiredCount: 5)) { v in
                    AxisGridLine()
                    AxisValueLabel {
                        if let d = v.as(Double.self) {
                            Text(visao == .ritmo ? formatarPace(d) : (visao == .diferenca ? "\(d > 0 ? "+" : "")\(Int(d)) min" : "\(Int(d))")).font(.caption2)
                        }
                    }
                }
            }
            .chartXSelection(value: $toque)
            .frame(height: 230)
            .padding(.top, 18)
            Text(visao == .diferenca ? "Minutos atrás (+) ou à frente (−) da referência; acima = à frente." : (visao == .ritmo ? "Pace por km, média de 3 km. Mais alto = mais rápido." : "Frequência cardíaca média em cada km."))
                .font(.caption2).foregroundStyle(Tema.textoSuave)
        }
    }

    private func cor(_ id: String) -> Color { ids.firstIndex(of: id).map { Self.cores[$0] } ?? .gray }

    private var tabela: some View {
        let sel = escolhidas
        let linhas: [(String, (Maratona) -> String)] = [
            ("Tempo", { formatarDuracao($0.tempoSeg) }),
            ("Pace", { formatarPace($0.paceSeg) }),
            ("10 km", { formatarDuracao($0.tempo(noKm: 10)) }),
            ("Meia", { formatarDuracao($0.tempo(noKm: 21.0975)) }),
            ("30 km", { formatarDuracao($0.tempo(noKm: 30)) }),
            ("Últimos 12,2", { formatarDuracao($0.tempoSeg - $0.tempo(noKm: 30)) }),
            ("2ª metade", { $0.leitura.map { formatarDiferenca($0.diferencaSeg) } ?? "—" }),
            ("Queda no km", { $0.leitura?.kmQueda.map { "\($0)" } ?? "—" }),
            ("FC média", { $0.fcMedia.map { "\(Int($0.rounded()))" } ?? "—" }),
            ("Subida", { $0.elevacaoM.map { "\(Int($0)) m" } ?? "—" }),
            ("VPONTO", { numeroBR($0.vponto) }),
            ("Km em 16 sem", { $0.preparo.map { "\(Int($0.km))" } ?? "—" }),
            ("Maior longão", { $0.preparo.map { "\(numeroBR($0.longaoKm)) km" } ?? "—" }),
        ]
        return Grid(alignment: .trailing, horizontalSpacing: 8, verticalSpacing: 7) {
            GridRow {
                Text("").gridColumnAlignment(.leading)
                ForEach(sel) { m in
                    Text(m.rotuloCurto).font(.caption.weight(.heavy)).foregroundStyle(cor(m.id)).lineLimit(1).minimumScaleFactor(0.6)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }
            }
            ForEach(linhas, id: \.0) { l in
                Divider()
                GridRow {
                    Text(l.0).font(.caption).foregroundStyle(Tema.textoSuave).lineLimit(1).fixedSize().gridColumnAlignment(.leading)
                    ForEach(sel) { m in
                        Text(l.1(m)).font(.footnote.weight(.semibold)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
                    }
                }
            }
        }
    }
}

// MARK: - Corrida fantasma

/// Todas as maratonas largando juntas: você contra você mesmo.
private struct CorridaFantasma: View {
    let todas: [Maratona]
    @State private var tempo = 0.0
    @State private var corrida: Task<Void, Never>?

    private var fim: Double { todas.map(\.tempoSeg).max() ?? 1 }

    var body: some View {
        let ordem = todas.sorted { a, b in
            let ka = a.km(noTempo: tempo), kb = b.km(noTempo: tempo)
            if ka >= Maratona.distanciaKm, kb >= Maratona.distanciaKm || tempo == 0 { return a.tempoSeg < b.tempoSeg }
            return ka == kb ? a.data < b.data : ka > kb
        }
        Secao(titulo: "Você contra você", icone: "figure.run", tom: Tema.vermelho) {
            Text("Todas as suas maratonas largando ao mesmo tempo. Aperte ▶ ou arraste.").font(.caption).foregroundStyle(Tema.textoSuave)
            HStack(spacing: 12) {
                Button(action: alternar) {
                    Image(systemName: corrida == nil ? "play.fill" : "pause.fill")
                        .font(.headline).foregroundStyle(.white).frame(width: 46, height: 46).background(Tema.vermelho, in: Circle())
                }
                .accessibilityLabel(corrida == nil ? "Largar" : "Pausar")
                VStack(alignment: .leading, spacing: 0) {
                    Text(formatarDuracao(tempo)).font(.title2.weight(.heavy)).monospacedDigit()
                    Slider(value: $tempo, in: 0...fim) { editando in if editando { parar() } }.tint(Tema.vermelho)
                }
            }
            VStack(spacing: 3) {
                ForEach(Array(ordem.enumerated()), id: \.element.id) { pos, m in
                    raia(m, pos: pos + 1)
                }
            }
            .animation(.easeInOut(duration: 0.35), value: ordem.map(\.id))
            Text("Nas provas sem parciais (até 2014 e Chicago) o ritmo é suposto constante.").font(.caption2).foregroundStyle(Tema.textoSuave)
        }
        .onDisappear { parar() }
    }

    private func raia(_ m: Maratona, pos: Int) -> some View {
        let km = m.km(noTempo: tempo)
        let chegou = km >= Maratona.distanciaKm
        return HStack(spacing: 6) {
            Text("\(pos)").font(.caption2.weight(.heavy)).foregroundStyle(Tema.textoSuave).frame(width: 16)
            Text(m.rotuloCurto).font(.caption2.weight(.medium)).lineLimit(1).minimumScaleFactor(0.7).frame(width: 84, alignment: .leading)
            GeometryReader { g in
                let x = (g.size.width - 18) * km / Maratona.distanciaKm
                ZStack(alignment: .leading) {
                    Capsule().fill(Tema.fundo).frame(height: 6)
                    Capsule().fill(chegou ? Tema.ouro : Tema.laranja.opacity(0.7)).frame(width: x + 9, height: 6)
                    Text(m.bandeira).font(.system(size: 15)).offset(x: x)
                }
                .frame(maxHeight: .infinity)
            }
            .frame(height: 20)
            Text(chegou ? formatarHorasMin(m.tempoSeg) : "\(numeroBR((km * 10).rounded(.down) / 10))")
                .font(.caption2.weight(.semibold)).monospacedDigit()
                .foregroundStyle(chegou ? Tema.ouro : Tema.textoSuave)
                .frame(width: 34, alignment: .trailing)
        }
    }

    private func parar() { corrida?.cancel(); corrida = nil }

    private func alternar() {
        if corrida != nil { parar(); return }
        if tempo >= fim { tempo = 0 }
        // a prova inteira em ~25 s
        let passo = fim / (25 * 30)
        corrida = Task {
            while !Task.isCancelled, tempo < fim {
                try? await Task.sleep(for: .milliseconds(33))
                if Task.isCancelled { return }
                tempo = min(fim, tempo + passo)
            }
            corrida = nil
        }
    }
}

// MARK: - Preparação × resultado

private struct GraficoPreparo: View {
    enum Eixo: String, CaseIterable { case km = "Km", longao = "Longão", trinta = "30+ km" }
    let todas: [Maratona]
    @State private var eixo: Eixo = .km

    private func x(_ p: Maratona.Preparo) -> Double {
        switch eixo {
        case .km: p.km
        case .longao: p.longaoKm
        case .trinta: Double(p.longoes30)
        }
    }

    var body: some View {
        let provas = todas.filter { $0.preparo != nil }
        let xs = provas.map { x($0.preparo!) }
        let ys = provas.map(\.tempoSeg)
        let folga = max(((xs.max() ?? 1) - (xs.min() ?? 0)) * 0.18, 1)
        if provas.count > 2 {
            Secao(titulo: "Preparação × resultado", icone: "calendar.badge.clock", tom: Tema.aqua) {
                Picker("Eixo", selection: $eixo) { ForEach(Eixo.allCases, id: \.self) { Text($0.rawValue) } }.pickerStyle(.segmented)
                Chart(provas) { m in
                    PointMark(x: .value("Preparo", x(m.preparo!)), y: .value("Tempo", m.tempoSeg))
                        .foregroundStyle(m.tempoSeg < 14_400 ? Tema.ouro : Tema.aqua)
                        .symbolSize(110)
                        .annotation(position: .top, spacing: 2) { Text(m.rotuloCurto).font(.system(size: 9, weight: .semibold)).foregroundStyle(Tema.texto) }
                }
                .chartXScale(domain: ((xs.min() ?? 0) - folga)...((xs.max() ?? 1) + folga))
                .modifier(EscalaY(dominio: [(ys.min() ?? 0) - 600, (ys.max() ?? 1) + 300], invertida: true))
                .chartYAxis {
                    AxisMarks(position: .leading) { v in
                        AxisGridLine()
                        AxisValueLabel { if let d = v.as(Double.self) { Text(formatarHorasMin(d)).font(.caption2) } }
                    }
                }
                .chartXAxisLabel(eixo == .km ? "km nas 16 semanas antes" : (eixo == .longao ? "maior longão (km)" : "longões de 30 km ou mais"), alignment: .center)
                .frame(height: 260)
                Text("Mais alto = mais rápido; dourado = abaixo de 4 h. São só \(provas.count) provas, com percursos e climas diferentes: serve de pista, não de prova.")
                    .font(.caption).foregroundStyle(Tema.textoSuave)
            }
        }
    }
}

// MARK: - Lista

private struct ListaMaratonas: View {
    enum Ordem: String, CaseIterable { case recentes = "Recentes", rapidas = "Mais rápidas", regulares = "Mais regulares" }
    let store: MaratonasStore
    var abrir: (Maratona) -> Void
    @State private var ordem: Ordem = .recentes

    private var lista: [Maratona] {
        switch ordem {
        case .recentes: store.todas.reversed()
        case .rapidas: store.todas.sorted { $0.tempoSeg < $1.tempoSeg }
        case .regulares: store.todas.filter { $0.leitura != nil }.sorted { abs($0.leitura!.diferencaSeg) < abs($1.leitura!.diferencaSeg) }
        }
    }

    var body: some View {
        let podio = Array(store.todas.sorted { $0.tempoSeg < $1.tempoSeg }.prefix(3).map(\.id))
        VStack(alignment: .leading, spacing: 10) {
            Text("Todas as provas").font(.title3.bold()).foregroundStyle(Tema.texto).padding(.top, 6)
            Picker("Ordem", selection: $ordem) { ForEach(Ordem.allCases, id: \.self) { Text($0.rawValue) } }.pickerStyle(.segmented)
            ForEach(lista) { m in
                Button { abrir(m) } label: { linha(m, medalha: podio.firstIndex(of: m.id)) }.buttonStyle(.plain)
            }
        }
    }

    private func linha(_ m: Maratona, medalha: Int?) -> some View {
        HStack(spacing: 12) {
            Text(m.bandeira).font(.system(size: 32)).frame(width: 48, height: 48).background(.white.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
            VStack(alignment: .leading, spacing: 3) {
                Text(m.nome).font(.subheadline.weight(.bold)).foregroundStyle(.white).lineLimit(1)
                Text("\(m.numero)ª · \(m.dataLonga)").font(.caption).foregroundStyle(.white.opacity(0.65)).lineLimit(1).minimumScaleFactor(0.8)
                HStack(spacing: 8) {
                    Text(formatarDuracao(m.tempoSeg)).font(.headline.weight(.heavy)).foregroundStyle(Tema.ouro)
                    Text("\(formatarPace(m.paceSeg))/km").font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.8))
                    if ordem == .regulares, let l = m.leitura {
                        Text("2ª \(formatarDiferenca(l.diferencaSeg))").font(.caption.weight(.semibold)).foregroundStyle(Tema.lima)
                    }
                }
                .monospacedDigit()
            }
            Spacer(minLength: 0)
            if let medalha { Text(["🥇", "🥈", "🥉"][medalha]).font(.title2) }
            Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(.white.opacity(0.4))
        }
        .padding(12)
        .background(escuroProva, in: RoundedRectangle(cornerRadius: 16))
    }
}
