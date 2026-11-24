import Charts
import MapKit
import SwiftUI

private let ptBR = Locale(identifier: "pt_BR")

// MARK: - Lista

@Observable
@MainActor
final class ResultadosStore {
    var corridas: [ResumoCorrida] = []
    var carregando = false
    var erro: String?

    func carregar() async {
        carregando = true
        defer { carregando = false }
        do {
            corridas = try await Servidor.listarCorridas()
            erro = nil
        } catch {
            erro = error.localizedDescription
        }
    }
}

struct ResultadosView: View {
    @State private var store = ResultadosStore()
    var ajustes: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Corridas do relógio").font(.subheadline).foregroundStyle(Tema.textoSuave)
                        Text("Resultados").font(.system(size: 40, weight: .heavy)).foregroundStyle(Tema.texto)
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

                if let erro = store.erro {
                    Label(erro, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .foregroundStyle(Color.orange)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
                }

                VStack(spacing: 8) {
                    ForEach(store.corridas) { c in
                        NavigationLink(value: c) { LinhaCorrida(corrida: c) }
                            .buttonStyle(.plain)
                    }
                }

                if store.corridas.isEmpty && !store.carregando && store.erro == nil {
                    Text("Nenhuma corrida do relógio ainda. Sincronize os treinos em Ajustes.")
                        .font(.footnote).foregroundStyle(Tema.textoSuave)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
        }
        .background(Tema.fundo)
        .refreshable { await store.carregar() }
        .toolbar(.hidden, for: .navigationBar)
        .navigationDestination(for: ResumoCorrida.self) { ResultadoCorridaView(resumo: $0) }
        .task { await store.carregar() }
    }
}

struct LinhaCorrida: View {
    let corrida: ResumoCorrida

    var body: some View {
        HStack(spacing: 12) {
            VStack(spacing: 0) {
                Text(corrida.data.formatted(.dateTime.weekday(.abbreviated).locale(ptBR)).uppercased().replacingOccurrences(of: ".", with: ""))
                    .font(.caption2.weight(.bold)).foregroundStyle(Tema.textoSuave)
                Text(corrida.data.formatted(.dateTime.day())).font(.title3.weight(.bold)).foregroundStyle(Tema.texto)
            }
            .frame(width: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(String(format: "%.2f km", corrida.distanciaM / 1000).replacingOccurrences(of: ".", with: ","))
                    .font(.body.weight(.semibold)).foregroundStyle(Tema.texto)
                Text(corrida.tipoSessao ?? corrida.nome)
                    .font(.caption).foregroundStyle(Tema.textoSuave).lineLimit(1)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(formatarPace(corrida.paceSegKm)) /km").font(.subheadline.weight(.semibold)).foregroundStyle(Tema.texto).monospacedDigit()
                Text(formatarDuracao(corrida.tempoSeg)).font(.caption).foregroundStyle(Tema.textoSuave).monospacedDigit()
            }
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
        }
        .padding(.vertical, 14)
        .padding(.horizontal, 16)
        .cartao(raio: 16)
    }
}

// MARK: - Detalhe

struct ResultadoCorridaView: View {
    let resumo: ResumoCorrida
    @State private var resultado: ResultadoCorrida?
    @State private var erro: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let r = resultado {
                    ConteudoResultado(r: r)
                } else if let erro {
                    Label(erro, systemImage: "exclamationmark.triangle.fill").foregroundStyle(Color.orange).font(.footnote)
                } else {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 60)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
        }
        .background(Tema.fundo)
        .navigationTitle(resumo.data.formatted(.dateTime.weekday(.wide).day().month(.wide).locale(ptBR)).capitalized)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            do { resultado = try await Servidor.buscarResultado(id: resumo.id) } catch { erro = error.localizedDescription }
        }
    }
}

private struct ConteudoResultado: View {
    let r: ResultadoCorrida

    var body: some View {
        cabecalho
        if r.polyline != nil { MapaRota(r: r) }
        if let c = r.comparacao, let p = r.planejado { BlocoComparacao(comparacao: c, planejado: p) }
        if let a = r.analise { BlocoAnalise(analise: a) }
        if r.serie.count > 10 { BlocoGraficos(serie: r.serie) }
        BlocoZonas(zonas: r.zonas)
        if r.splits.count >= 2 { BlocoSplits(splits: r.splits) }
        if r.voltas.count > 1 { BlocoVoltas(voltas: r.voltas) }
        BlocoMetricas(m: r.metricas)
    }

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(String(format: "%.2f", r.distanciaM / 1000).replacingOccurrences(of: ".", with: ",") + " km")
                .font(.system(size: 44, weight: .heavy)).foregroundStyle(Tema.texto)
            HStack(spacing: 10) {
                Metrica(titulo: "Tempo", valor: formatarDuracao(r.tempoSeg))
                Metrica(titulo: "Pace", valor: "\(formatarPace(r.paceSegKm)) /km")
                Metrica(titulo: "FC média", valor: r.metricas.fcMedia.map { "\(Int($0.rounded())) bpm" } ?? "—")
            }
        }
    }
}

// MARK: - Mapa

private struct MapaRota: View {
    let r: ResultadoCorrida

    var body: some View {
        let coords = r.coordenadas
        Map(initialPosition: .region(regiao(coords)), interactionModes: [.pan, .zoom]) {
            MapPolyline(coordinates: coords).stroke(Tema.laranja, lineWidth: 5)
            if let ini = coords.first { Annotation("Largada", coordinate: ini) { Circle().fill(Tema.aqua).frame(width: 12, height: 12).overlay(Circle().stroke(.white, lineWidth: 2)) } }
            if let fim = coords.last { Annotation("Chegada", coordinate: fim) { Circle().fill(Tema.texto).frame(width: 12, height: 12).overlay(Circle().stroke(.white, lineWidth: 2)) } }
        }
        .mapStyle(.standard(elevation: .realistic))
        .frame(height: 260)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Tema.linha, lineWidth: 1))
    }

    private func regiao(_ c: [CLLocationCoordinate2D]) -> MKCoordinateRegion {
        guard let primeiro = c.first else { return MKCoordinateRegion() }
        var minLat = primeiro.latitude, maxLat = primeiro.latitude, minLng = primeiro.longitude, maxLng = primeiro.longitude
        for p in c {
            minLat = min(minLat, p.latitude); maxLat = max(maxLat, p.latitude)
            minLng = min(minLng, p.longitude); maxLng = max(maxLng, p.longitude)
        }
        return MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2),
            span: MKCoordinateSpan(latitudeDelta: max((maxLat - minLat) * 1.35, 0.004), longitudeDelta: max((maxLng - minLng) * 1.35, 0.004))
        )
    }
}

// MARK: - Seções

private struct Secao<Conteudo: View>: View {
    let titulo: String
    var cor: Color = Tema.texto
    @ViewBuilder var conteudo: () -> Conteudo

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(titulo).font(.title3.bold()).foregroundStyle(cor)
            conteudo()
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cartao(raio: 20)
    }
}

private struct BlocoAnalise: View {
    let analise: AnaliseIA

    private var corAvaliacao: Color {
        switch analise.avaliacao {
        case "excelente": Tema.aqua
        case "bom": Tema.azul
        case "regular": Tema.laranja
        default: Tema.vermelho
        }
    }

    var body: some View {
        Secao(titulo: "Treinador IA", cor: Tema.laranja) {
            HStack(alignment: .firstTextBaseline) {
                Text(analise.tipoSessao).font(.headline).foregroundStyle(Tema.texto)
                Spacer()
                Selo(texto: analise.avaliacao, cor: corAvaliacao)
            }
            Text(analise.resumo).font(.subheadline).foregroundStyle(Tema.texto)
            ForEach(analise.pontosPositivos, id: \.self) { p in
                Label { Text(p).font(.subheadline) } icon: { Image(systemName: "checkmark.circle.fill").foregroundStyle(Tema.aqua) }
            }
            ForEach(analise.pontosAtencao, id: \.self) { p in
                Label { Text(p).font(.subheadline) } icon: { Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Tema.laranja) }
            }
            if let m = analise.metricasRelogio, !m.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("MÉTRICAS DO RELÓGIO").font(.caption.weight(.heavy)).foregroundStyle(Tema.azul)
                    Text(m).font(.subheadline).foregroundStyle(Tema.texto)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Tema.azul.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("PRÓXIMO TREINO").font(.caption.weight(.heavy)).foregroundStyle(Tema.textoSuave)
                Text(analise.recomendacao).font(.subheadline).foregroundStyle(Tema.texto)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Tema.fundo, in: RoundedRectangle(cornerRadius: 12))
        }
    }
}

private struct BlocoComparacao: View {
    let comparacao: ComparacaoResultado
    let planejado: PlanejadoResultado

    private func cor(_ status: String) -> Color {
        switch status {
        case "dentro": Tema.aqua
        case "rapido": Tema.azul
        case "lento": Tema.laranja
        default: Tema.cinzaPausa
        }
    }

    private var pontos: [LinhaComparacao] { comparacao.linhas.filter { $0.diffSeg != nil } }

    var body: some View {
        Secao(titulo: "Planejado × executado") {
            Text("\(planejado.titulo) · \(comparacao.resumo.dentro) de \(comparacao.resumo.avaliadas) \(comparacao.base == "km" ? "km" : "esforços") na faixa")
                .font(.subheadline).foregroundStyle(Tema.textoSuave)

            if !pontos.isEmpty {
                let limite = max(30, min(90, (pontos.map { abs($0.diffSeg ?? 0) }.max() ?? 30) + 10))
                Chart(pontos) { l in
                    BarMark(x: .value("Diferença", max(-limite, min(limite, l.diffSeg ?? 0))), y: .value("Etapa", l.rotulo))
                        .foregroundStyle(cor(l.status))
                        .cornerRadius(4)
                }
                .chartXScale(domain: -limite...limite)
                .chartXAxis {
                    AxisMarks { v in
                        AxisGridLine()
                        AxisValueLabel { if let d = v.as(Double.self) { Text(d > 0 ? "+\(Int(d))s" : "\(Int(d))s").font(.caption2) } }
                    }
                }
                .frame(height: CGFloat(60 + pontos.count * 30))
                HStack {
                    Text("← mais rápido").font(.caption2).foregroundStyle(Tema.textoSuave)
                    Spacer()
                    Text("mais lento →").font(.caption2).foregroundStyle(Tema.textoSuave)
                }
            }

            ForEach(comparacao.linhas) { l in
                HStack {
                    Text(l.rotulo).font(.subheadline.weight(.medium)).foregroundStyle(Tema.texto)
                    Spacer()
                    VStack(alignment: .trailing, spacing: 1) {
                        Text(l.execSeg.map { "\(formatarPace($0)) /km" } ?? "—").font(.subheadline.weight(.semibold)).monospacedDigit()
                        if let r = l.planRapidoSeg, let lt = l.planLentoSeg {
                            Text("plano \(formatarPace(r))–\(formatarPace(lt))").font(.caption2).foregroundStyle(Tema.textoSuave).monospacedDigit()
                        }
                    }
                    Circle().fill(cor(l.status)).frame(width: 9, height: 9)
                }
            }
        }
    }
}

private struct BlocoGraficos: View {
    let serie: [PontoSerie]

    private var paces: [Double] { serie.compactMap(\.pace) }
    private var fcs: [Double] { serie.compactMap(\.fc) }
    private var alts: [Double] { serie.compactMap(\.alt) }

    private func percentil(_ v: [Double], _ p: Double) -> Double {
        let o = v.sorted()
        return o[min(o.count - 1, max(0, Int((p * Double(o.count - 1)).rounded())))]
    }

    var body: some View {
        Secao(titulo: "Ritmo, FC e altitude") {
            if !paces.isEmpty {
                Text("PACE").font(.caption.weight(.heavy)).foregroundStyle(Tema.azul)
                let lo = (percentil(paces, 0.03) / 10).rounded(.down) * 10 - 10
                let hi = (percentil(paces, 0.97) / 10).rounded(.up) * 10 + 10
                Chart(serie.filter { $0.pace != nil }) { p in
                    LineMark(x: .value("km", p.km), y: .value("pace", -(p.pace ?? 0)))
                        .foregroundStyle(Tema.azul)
                        .interpolationMethod(.monotone)
                }
                .chartYScale(domain: -hi ... -lo)
                .chartYAxis {
                    AxisMarks { v in
                        AxisGridLine()
                        AxisValueLabel { if let d = v.as(Double.self) { Text(formatarPace(-d)).font(.caption2) } }
                    }
                }
                .chartXAxis { AxisMarks(values: .automatic(desiredCount: 5)) { v in AxisValueLabel { if let d = v.as(Double.self) { Text("\(Int(d)) km").font(.caption2) } } } }
                .frame(height: 150)
            }
            if !fcs.isEmpty {
                Text("FREQUÊNCIA CARDÍACA").font(.caption.weight(.heavy)).foregroundStyle(Tema.vermelho)
                Chart(serie.filter { $0.fc != nil }) { p in
                    LineMark(x: .value("km", p.km), y: .value("fc", p.fc ?? 0))
                        .foregroundStyle(Tema.vermelho)
                        .interpolationMethod(.monotone)
                }
                .chartYScale(domain: ((fcs.min() ?? 60) - 5)...((fcs.max() ?? 180) + 5))
                .chartXAxis(.hidden)
                .frame(height: 120)
            }
            if !alts.isEmpty {
                Text("ALTITUDE").font(.caption.weight(.heavy)).foregroundStyle(Tema.textoSuave)
                Chart(serie.filter { $0.alt != nil }) { p in
                    AreaMark(x: .value("km", p.km), yStart: .value("base", (alts.min() ?? 0) - 5), yEnd: .value("alt", p.alt ?? 0))
                        .foregroundStyle(Tema.cinzaPausa.opacity(0.35))
                }
                .chartYScale(domain: ((alts.min() ?? 0) - 5)...((alts.max() ?? 0) + 5))
                .chartXAxis { AxisMarks(values: .automatic(desiredCount: 5)) { v in AxisValueLabel { if let d = v.as(Double.self) { Text("\(Int(d)) km").font(.caption2) } } } }
                .frame(height: 90)
            }
        }
    }
}

private struct BlocoZonas: View {
    let zonas: ZonasResultado
    @State private var aba = 0

    private func cor(_ ordem: Int, pace: Bool) -> Color {
        if pace {
            switch ordem {
            case 0: Tema.cinzaPausa
            case 1: Zona.z1.cor
            case 2: Zona.z2.cor
            case 3: Zona.z3.cor
            case 4: Zona.z4.cor
            case 5: Zona.z5.cor
            default: Zona.z6.cor
            }
        } else {
            [Tema.azul, Tema.aqua, Color(red: 0.80, green: 0.68, blue: 0.20), Tema.laranja, Tema.vermelho][min(max(ordem - 1, 0), 4)]
        }
    }

    var body: some View {
        if zonas.pace != nil || zonas.fc != nil {
            Secao(titulo: "Tempo por zona") {
                if zonas.pace != nil && zonas.fc != nil {
                    Picker("Zona", selection: $aba) {
                        Text("Pace").tag(0)
                        Text("Freq. cardíaca").tag(1)
                    }
                    .pickerStyle(.segmented)
                }
                let usarPace = (aba == 0 && zonas.pace != nil) || zonas.fc == nil
                let linhas = (usarPace ? zonas.pace : zonas.fc) ?? []
                ForEach(linhas) { l in
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(l.id == "—" ? l.nome : "\(l.id) · \(l.nome)").font(.subheadline.weight(.medium)).foregroundStyle(Tema.texto).lineLimit(1)
                            Text(l.faixa).font(.caption2).foregroundStyle(Tema.textoSuave)
                        }
                        .frame(width: 130, alignment: .leading)
                        GeometryReader { g in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Tema.fundo)
                                Capsule().fill(cor(l.ordem, pace: usarPace)).frame(width: max(g.size.width * l.pct / 100, l.pct > 0 ? 6 : 0))
                            }
                        }
                        .frame(height: 10)
                        VStack(alignment: .trailing, spacing: 0) {
                            Text("\(Int(l.pct.rounded()))%").font(.subheadline.weight(.semibold)).monospacedDigit()
                            Text(formatarDuracao(l.seg)).font(.caption2).foregroundStyle(Tema.textoSuave).monospacedDigit()
                        }
                        .frame(width: 48, alignment: .trailing)
                    }
                }
                if !usarPace {
                    Text("Zonas por % da FC máxima (\(Int(zonas.fcMaxima)) bpm)").font(.caption2).foregroundStyle(Tema.textoSuave)
                }
            }
        }
    }
}

private struct BlocoSplits: View {
    let splits: [SplitKm]
    @State private var metrica = 0

    private var completos: [SplitKm] { splits.filter { $0.distanciaM >= 950 } }

    private var mediaPace: Double? {
        let p = completos.compactMap(\.paceSegKm)
        return p.isEmpty ? nil : p.reduce(0, +) / Double(p.count)
    }

    private func corPace(_ pace: Double, media: Double) -> Color {
        let d = pace - media
        if d < -3 { return Tema.azul }
        if d > 3 { return Tema.laranja }
        return Tema.cinzaPausa
    }

    /// Primeira metade contra a segunda (pace médio ponderado pelos km)
    private var metades: (primeira: Double, segunda: Double)? {
        guard completos.count >= 4 else { return nil }
        let meio = completos.count / 2
        func pace(_ s: ArraySlice<SplitKm>) -> Double {
            let d = s.reduce(0) { $0 + $1.distanciaM }
            let t = s.reduce(0) { $0 + $1.tempoSeg }
            return t / (d / 1000)
        }
        return (pace(completos[0..<meio]), pace(completos[(completos.count - meio)...]))
    }

    var body: some View {
        Secao(titulo: "Variação por km", cor: Tema.laranja) {
            Picker("Métrica", selection: $metrica) {
                Text("Pace").tag(0)
                Text("FC").tag(1)
            }
            .pickerStyle(.segmented)

            if metrica == 0, let media = mediaPace {
                Text("Média \(formatarPace(media)) /km · barras mostram a diferença para a média (para cima = mais rápido)")
                    .font(.caption).foregroundStyle(Tema.textoSuave)
                Chart(completos) { s in
                    if let p = s.paceSegKm {
                        BarMark(x: .value("Km", String(s.km)), y: .value("Diferença", media - p))
                            .foregroundStyle(corPace(p, media: media))
                            .cornerRadius(4)
                    }
                }
                .chartYAxis {
                    AxisMarks { v in
                        AxisGridLine()
                        AxisValueLabel { if let d = v.as(Double.self) { Text(d > 0 ? "+\(Int(d))s" : "\(Int(d))s").font(.caption2) } }
                    }
                }
                .frame(height: 170)
                HStack(spacing: 14) {
                    Label("Mais rápido", systemImage: "circle.fill").foregroundStyle(Tema.azul)
                    Label("No ritmo", systemImage: "circle.fill").foregroundStyle(Tema.cinzaPausa)
                    Label("Mais lento", systemImage: "circle.fill").foregroundStyle(Tema.laranja)
                }
                .font(.caption2)
            } else {
                let fcs = completos.compactMap(\.fcMedia)
                if fcs.isEmpty {
                    Text("Sem FC por km.").font(.footnote).foregroundStyle(Tema.textoSuave)
                } else {
                    Chart(completos) { s in
                        if let f = s.fcMedia {
                            BarMark(x: .value("Km", String(s.km)), y: .value("FC", f)).foregroundStyle(Tema.vermelho.opacity(0.85)).cornerRadius(4)
                        }
                    }
                    .chartYScale(domain: max(0, (fcs.min() ?? 60) - 15)...((fcs.max() ?? 180) + 5))
                    .frame(height: 170)
                }
            }

            if let m = metades {
                let dif = (m.primeira - m.segunda) / m.primeira * 100
                Divider()
                Text(dif > 0 ? "Split negativo · \(String(format: "%.1f", dif).replacingOccurrences(of: ".", with: ","))%" : "Split positivo · \(String(format: "%.1f", -dif).replacingOccurrences(of: ".", with: ","))%")
                    .font(.headline).foregroundStyle(Tema.texto)
                HStack(spacing: 10) {
                    Metrica(titulo: "1ª metade", valor: "\(formatarPace(m.primeira)) /km")
                    Metrica(titulo: "2ª metade", valor: "\(formatarPace(m.segunda)) /km")
                }
            }
        }
    }
}

private struct BlocoVoltas: View {
    let voltas: [VoltaResultado]

    var body: some View {
        Secao(titulo: "Etapas") {
            ForEach(voltas) { v in
                HStack {
                    Text(v.rotulo).font(.subheadline.weight(.medium)).foregroundStyle(Tema.texto)
                    Spacer()
                    VStack(alignment: .trailing, spacing: 1) {
                        Text(v.distanciaM >= 1000 ? String(format: "%.2f km", v.distanciaM / 1000).replacingOccurrences(of: ".", with: ",") : "\(Int(v.distanciaM)) m")
                            .font(.subheadline.weight(.semibold))
                        Text("\(formatarDuracao(v.tempoSeg)) · \(v.distanciaM >= 150 ? formatarPace(v.tempoSeg / (v.distanciaM / 1000)) + " /km" : "—")\(v.fcMedia.map { " · \(Int($0.rounded())) bpm" } ?? "")")
                            .font(.caption2).foregroundStyle(Tema.textoSuave).monospacedDigit()
                    }
                }
            }
        }
    }
}

private struct BlocoMetricas: View {
    let m: MetricasResultado

    private var itens: [(String, String)] {
        var r: [(String, String)] = []
        if let v = m.potenciaW { r.append(("Potência", "\(Int(v.rounded())) W")) }
        if let v = m.cadencia { r.append(("Cadência", "\(Int(v.rounded())) ppm")) }
        if let v = m.passadaM { r.append(("Passada", String(format: "%.2f m", v).replacingOccurrences(of: ".", with: ","))) }
        if let v = m.oscilacaoCm { r.append(("Oscilação vertical", String(format: "%.1f cm", v).replacingOccurrences(of: ".", with: ","))) }
        if let v = m.contatoMs { r.append(("Contato com o solo", "\(Int(v.rounded())) ms")) }
        if let v = m.fcMaxima { r.append(("FC máxima", "\(Int(v.rounded())) bpm")) }
        if let v = m.caloriasKcal { r.append(("Calorias ativas", "\(Int(v.rounded())) kcal")) }
        return r
    }

    var body: some View {
        if !itens.isEmpty {
            Secao(titulo: "Métricas do Apple Watch") {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ForEach(itens, id: \.0) { Metrica(titulo: $0.0, valor: $0.1) }
                }
            }
        }
    }
}
