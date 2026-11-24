import Charts
import MapKit
import SwiftUI

private let ptBR = Locale(identifier: "pt_BR")

// MARK: - Lista

@Observable
@MainActor
final class ResultadosStore {
    var corridas: [ResumoCorrida] = []
    var ano = Calendar.current.component(.year, from: Date())
    var carregando = false
    var erro: String?
    /// tipo de sessão da análise por IA, quando a corrida já está no site
    var tiposDoSite: [String: String] = [:]

    func carregar(saude: SaudeSync) async {
        carregando = true
        defer { carregando = false }
        if saude.anosDisponiveis.isEmpty { await saude.carregarAnos() }
        do {
            corridas = try await saude.listarCorridas(ano: ano)
            erro = nil
        } catch {
            erro = error.localizedDescription
        }
        // opcional: marca as que a IA já analisou (ignora falha de rede)
        if tiposDoSite.isEmpty, let doSite = try? await Servidor.listarCorridas(limite: 60) {
            tiposDoSite = Dictionary(uniqueKeysWithValues: doSite.compactMap { c in c.tipoSessao.map { (c.id.uppercased(), $0) } })
        }
    }
}

struct ResultadosView: View {
    @State private var store = ResultadosStore()
    var saude: SaudeSync
    var ajustes: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Direto do app Saúde").font(.subheadline).foregroundStyle(Tema.textoSuave)
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

                HStack {
                    if saude.anosDisponiveis.count > 1 {
                        Picker("Ano", selection: $store.ano) {
                            ForEach(saude.anosDisponiveis, id: \.self) { Text(String($0)).tag($0) }
                        }
                        .pickerStyle(.menu)
                        .tint(Tema.texto)
                    }
                    Spacer()
                    Text("\(store.corridas.count) corridas · \(String(format: "%.0f", store.corridas.reduce(0) { $0 + $1.distanciaM } / 1000)) km")
                        .font(.subheadline).foregroundStyle(Tema.textoSuave)
                }

                if let erro = store.erro {
                    Label(erro, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .foregroundStyle(Color.orange)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
                }

                if store.carregando && store.corridas.isEmpty { ProgressView().frame(maxWidth: .infinity).padding(.top, 30) }

                VStack(spacing: 8) {
                    ForEach(store.corridas) { c in
                        NavigationLink(value: c) {
                            LinhaCorrida(corrida: c, tipoSessao: store.tiposDoSite[c.id.uppercased()])
                        }
                        .buttonStyle(.plain)
                    }
                }

                if store.corridas.isEmpty && !store.carregando && store.erro == nil {
                    Text("Nenhuma corrida de \(String(store.ano)) no app Saúde.")
                        .font(.footnote).foregroundStyle(Tema.textoSuave)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
        }
        .background(Tema.fundo)
        .refreshable { await store.carregar(saude: saude) }
        .toolbar(.hidden, for: .navigationBar)
        .navigationDestination(for: ResumoCorrida.self) { ResultadoCorridaView(resumo: $0, saude: saude) }
        .task(id: store.ano) { await store.carregar(saude: saude) }
    }
}

struct LinhaCorrida: View {
    let corrida: ResumoCorrida
    var tipoSessao: String? = nil

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
                Text(tipoSessao ?? corrida.tipoSessao ?? corrida.nome)
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
    var saude: SaudeSync
    @State private var resultado: ResultadoCorrida?
    @State private var payload: TreinoSaudePayload?
    @State private var erro: String?
    @State private var analisando = false
    @State private var avisoIA: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let r = resultado {
                    ConteudoResultado(r: r, aoAnalisar: r.analise == nil && Servidor.configurado ? { Task { await analisar() } } : nil, analisando: analisando, avisoIA: avisoIA)
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
        .task { await carregar() }
    }

    private func carregar() async {
        do {
            guard let p = try await saude.payloadDaCorrida(id: resumo.id) else {
                erro = "Não encontrei essa corrida no app Saúde."
                return
            }
            payload = p
            var r = ConstrutorResultado.montar(payload: p, fcMaxima: await saude.fcMaximaReferencia())
            r.nome = resumo.nome
            resultado = r
        } catch {
            erro = error.localizedDescription
            return
        }
        await mesclarComSite()
    }

    /// Se a corrida já está no site, traz de lá a análise por IA, o treino planejado e a comparação.
    private func mesclarComSite() async {
        guard Servidor.configurado, let local = resultado, let remoto = try? await Servidor.buscarResultado(id: resumo.id) else { return }
        var r = local
        r.analise = remoto.analise
        r.analisadaEm = remoto.analisadaEm
        r.planejado = remoto.planejado
        r.comparacao = remoto.comparacao
        if !remoto.voltas.isEmpty { r.voltas = remoto.voltas } // nomes que levam o plano em conta
        resultado = r
    }

    /// Envia só esta corrida ao site, pede a análise e traz o resultado de volta.
    private func analisar() async {
        guard let p = payload else { return }
        analisando = true
        avisoIA = nil
        defer { analisando = false }
        do {
            _ = try await Servidor.enviarTreinosSaude([p])
            try await Servidor.analisarCorrida(id: resumo.id)
            await mesclarComSite()
        } catch {
            avisoIA = "Não foi possível analisar: \(error.localizedDescription)"
        }
    }
}

private struct ConteudoResultado: View {
    let r: ResultadoCorrida
    var aoAnalisar: (() -> Void)?
    var analisando = false
    var avisoIA: String?

    var body: some View {
        cabecalho
        if r.polyline != nil { MapaRota(r: r) }
        if let c = r.comparacao, let p = r.planejado { BlocoComparacao(comparacao: c, planejado: p) }
        if let a = r.analise {
            BlocoAnalise(analise: a)
        } else if aoAnalisar != nil || analisando {
            Secao(titulo: "Treinador IA", cor: Tema.laranja) {
                Text("Envia esta corrida ao site e pede uma análise com a sua metodologia, usando as etapas, os splits e as métricas do relógio.")
                    .font(.subheadline).foregroundStyle(Tema.textoSuave)
                Button { aoAnalisar?() } label: {
                    HStack { if analisando { ProgressView() }; Text(analisando ? "Analisando…" : "Analisar com IA") }
                }
                .buttonStyle(BotaoPrincipal())
                .disabled(analisando)
                if let avisoIA { Text(avisoIA).font(.footnote).foregroundStyle(Tema.vermelho) }
            }
        }
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

    /// Etapas com pace executado e faixa planejada: só essas entram no gráfico.
    private var pontos: [(rotulo: String, linha: LinhaComparacao)] {
        var esforco = 0
        return comparacao.linhas.compactMap { l in
            if l.papel == "trabalho" { esforco += 1 }
            guard l.execSeg != nil, l.planRapidoSeg != nil, l.planLentoSeg != nil else { return nil }
            let curto: String
            switch l.papel {
            case "aquecimento": curto = "Aquec."
            case "desaquecimento": curto = "Desaq."
            case "recuperacao": curto = "Rec."
            case "km": curto = l.rotulo.replacingOccurrences(of: "Km ", with: "")
            default: curto = "E\(esforco)"
            }
            return (curto, l)
        }
    }

    /// Velocidade em km/h: barra mais alta = mais rápido (o contrário do pace, que é menor quando se corre mais rápido).
    private func velocidade(_ pace: Double) -> Double { 3600 / pace }

    private var textoResumo: String {
        let r = comparacao.resumo
        let unidade = comparacao.base == "km" ? "km" : (r.avaliadas == 1 ? "esforço" : "esforços")
        return "\(planejado.titulo) · \(r.dentro) de \(r.avaliadas) \(unidade) na faixa"
    }

    var body: some View {
        Secao(titulo: "Planejado × executado") {
            Text(textoResumo).font(.subheadline).foregroundStyle(Tema.textoSuave)

            if !pontos.isEmpty {
                let maxVel = (pontos.flatMap { [velocidade($0.linha.planRapidoSeg ?? 600), velocidade($0.linha.execSeg ?? 600)] }.max() ?? 12) * 1.18
                Chart {
                    ForEach(pontos, id: \.linha.id) { p in
                        let l = p.linha
                        // planejado, atrás: coluna cinza até o limite lento e, por cima, a faixa entre o lento e o rápido
                        BarMark(x: .value("Etapa", p.rotulo), yStart: .value("base", 0), yEnd: .value("lento", velocidade(l.planLentoSeg ?? 600)), width: .ratio(0.78))
                            .foregroundStyle(Tema.cinzaPausa.opacity(0.28))
                        BarMark(x: .value("Etapa", p.rotulo), yStart: .value("lento", velocidade(l.planLentoSeg ?? 600)), yEnd: .value("rápido", velocidade(l.planRapidoSeg ?? 600)), width: .ratio(0.78))
                            .foregroundStyle(Tema.roxo.opacity(0.38))
                        // executado, na frente e translúcido: passou da faixa ou ficou aquém?
                        BarMark(x: .value("Etapa", p.rotulo), yStart: .value("base", 0), yEnd: .value("executado", velocidade(l.execSeg ?? 600)), width: .ratio(0.44))
                            .foregroundStyle(cor(l.status).opacity(0.62))
                            .annotation(position: .top, spacing: 2) {
                                Text(formatarPace(l.execSeg)).font(.caption2.weight(.semibold)).foregroundStyle(Tema.texto)
                            }
                    }
                }
                .chartYScale(domain: 0...maxVel)
                .chartYAxis {
                    AxisMarks { v in
                        AxisGridLine()
                        AxisValueLabel { if let d = v.as(Double.self) { Text("\(Int(d)) km/h").font(.caption2) } }
                    }
                }
                .frame(height: 230)

                HStack(spacing: 12) {
                    legenda(Tema.cinzaPausa.opacity(0.4), "plano")
                    legenda(Tema.roxo.opacity(0.5), "faixa do plano")
                    legenda(Tema.aqua, "dentro")
                    legenda(Tema.azul, "mais rápido")
                    legenda(Tema.laranja, "mais lento")
                }
                .font(.caption2).foregroundStyle(Tema.textoSuave)
                Text("Barra mais alta = mais rápido. A barra colorida é o que você correu; quando passa do topo da faixa roxa, foi mais rápido que o plano.")
                    .font(.caption).foregroundStyle(Tema.textoSuave)
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

    private func legenda(_ cor: Color, _ texto: String) -> some View {
        HStack(spacing: 4) {
            RoundedRectangle(cornerRadius: 2).fill(cor).frame(width: 10, height: 10)
            Text(texto)
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

    private struct PontoPace: Identifiable {
        let km: Double
        let y: Double
        let trecho: Int
        var id: Double { km }
    }

    /// Pace (negativo, para o eixo invertido) preso ao intervalo do eixo e separado em trechos contínuos.
    private func segmentos(lo: Double, hi: Double) -> [PontoPace] {
        var saida: [PontoPace] = []
        var trecho = 0
        for p in serie {
            guard let pace = p.pace else { trecho += 1; continue }
            saida.append(PontoPace(km: p.km, y: -min(max(pace, lo), hi), trecho: trecho))
        }
        return saida
    }

    var body: some View {
        Secao(titulo: "Ritmo, FC e altitude") {
            if !paces.isEmpty {
                Text("PACE").font(.caption.weight(.heavy)).foregroundStyle(Tema.azul)
                let lo = (percentil(paces, 0.03) / 10).rounded(.down) * 10 - 10
                let hi = (percentil(paces, 0.97) / 10).rounded(.up) * 10 + 10
                Chart(segmentos(lo: lo, hi: hi)) { p in
                    // cada trecho contínuo é uma linha; paradas (sem pace) quebram a linha em vez de cruzar o gráfico
                    LineMark(x: .value("km", p.km), y: .value("pace", p.y), series: .value("trecho", p.trecho))
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
