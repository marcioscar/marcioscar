import Charts
import SwiftUI

// MARK: - Modelos (resposta de GET /api/vpontos)

struct PainelVpontoApp: Codable {
    struct Zona: Codable, Identifiable {
        var id: String
        var nome: String
        var lentoSeg: Double
        var rapidoSeg: Double
        var uso: String
    }
    struct RitmoChave: Codable, Identifiable {
        var letra: String
        var nome: String
        var paceSeg: Double
        var uso: String
        var id: String { letra }
    }
    struct Previsao: Codable, Identifiable {
        var nome: String
        var distanciaM: Double
        var tempoSeg: Double
        var paceSeg: Double
        var id: String { nome }
    }
    struct Prova: Codable, Identifiable {
        var data: String
        var nome: String
        var distanciaKm: Double
        var tempoSeg: Double
        var vponto: Double
        var id: String { data + nome }
    }
    struct Esforco: Codable, Identifiable {
        var km: Int
        var data: String
        var nome: String
        var paceSeg: Double
        var fcMedia: Double?
        var vponto: Double
        var id: Int { km }
    }
    struct EstimativaFc: Codable, Identifiable {
        var data: String
        var km: Double
        var paceSeg: Double
        var vponto: Double
        var id: String { data }
    }
    struct Registro: Codable, Identifiable {
        var vponto: Double
        var desde: String
        var origem: String
        var treinosAjustados: Int
        var id: String { desde + String(vponto) }
    }
    struct Sugestao: Codable {
        var vponto: Double
        var texto: String
    }

    var vponto: Double
    var desde: String
    var origem: String
    var diasDesdeMudanca: Int
    var fcMaxima: Double
    var sugestao: Sugestao?
    var zonas: [Zona]
    var ritmosChave: [RitmoChave]
    var previsoes: [Previsao]
    var provas: [Prova]
    var esforcos: [Esforco]
    var porFc: [EstimativaFc]
    var medianaFc: Double?
    var historico: [Registro]
    var evolucao: Evolucao
}

/// Evolução do atleta (volume por zona, eficiência aeróbia, VPONTO mensal e critérios).
struct Evolucao: Codable {
    struct Semana: Codable, Identifiable {
        var inicio: String
        var km: Double
        var facilKm: Double
        var maratonaKm: Double
        var limiarKm: Double
        var intervaladoKm: Double
        var repeticaoKm: Double
        var longaoKm: Double
        var corridas: Int
        var emAndamento: Bool
        var id: String { inicio }
    }
    struct PontoMensal: Codable, Identifiable {
        var mes: String
        var valor: Double
        var n: Int
        var id: String { mes }
    }
    struct Criterio: Codable, Identifiable {
        var id: String
        var titulo: String
        var valor: String
        var referencia: String
        var status: String
        var detalhe: String
    }
    var semanas: [Semana]
    var eficiencia: [PontoMensal]
    var faixaFc: [Double]
    var vpontoMensal: [PontoMensal]
    var criteriosDaniels: [Criterio]
    var indicadoresCanova: [Criterio]
}

private let formatadorData: DateFormatter = {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.dateFormat = "yyyy-MM-dd"
    f.locale = Locale(identifier: "en_US_POSIX")
    return f
}()

private func data(_ s: String) -> Date { formatadorData.date(from: s) ?? Date() }
private func curta(_ s: String) -> String {
    data(s).formatted(.dateTime.day().month(.abbreviated).locale(Locale(identifier: "pt_BR"))).replacingOccurrences(of: ".", with: "")
}
private func numero(_ v: Double, casas: Int = 1) -> String { String(format: "%.\(casas)f", v).replacingOccurrences(of: ".", with: ",") }

// MARK: - Aba

@Observable
@MainActor
final class VpontoStore {
    var painel: PainelVpontoApp?
    var carregando = false
    var erro: String?

    func carregar() async {
        carregando = true
        defer { carregando = false }
        do {
            painel = try await Servidor.buscarVpontos()
            erro = nil
        } catch {
            erro = error.localizedDescription
        }
    }
}

struct VpontoView: View {
    @State private var store = VpontoStore()
    @Environment(\.scenePhase) private var fase
    var ajustes: () -> Void

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Método de Jack Daniels").font(.subheadline).foregroundStyle(Tema.textoSuave)
                        Text("VPONTO").font(.system(size: 40, weight: .heavy)).foregroundStyle(Tema.texto)
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

                if let p = store.painel {
                    Heroi(p: p)
                    if let s = p.sugestao { AvisoSugestao(s: s) }
                    GraficoZonas(p: p)
                    BlocoRitmosChave(p: p)
                    GraficoEvolucao(p: p)
                    BlocoEvolucaoAtleta(e: p.evolucao, vpontoEmUso: p.vponto)
                    BlocoPrevisoes(p: p)
                    BlocoEvidencias(p: p)
                    BlocoComoFunciona(p: p)
                } else if store.carregando {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
        }
        .background(FundoColorido())
        .refreshable { await store.carregar() }
        .toolbar(.hidden, for: .navigationBar)
        .task { await store.carregar() }
        .onChange(of: fase) { _, nova in
            if nova == .active { Task { await store.carregar() } }
        }
    }
}

// MARK: - Topo: o número e um anel

private struct Heroi: View {
    let p: PainelVpontoApp

    /// anel de 30 a 60 (iniciante a muito forte)
    private var fracao: Double { min(max((p.vponto - 30) / 30, 0), 1) }

    var body: some View {
        HStack(spacing: 18) {
            ZStack {
                Circle().stroke(Tema.linha, lineWidth: 12)
                Circle()
                    .trim(from: 0, to: fracao)
                    .stroke(
                        AngularGradient(colors: [Tema.azul, Tema.aqua, Tema.lima, Tema.laranja], center: .center),
                        style: StrokeStyle(lineWidth: 12, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                VStack(spacing: 0) {
                    Text(p.vponto.rounded() == p.vponto ? String(Int(p.vponto)) : numero(p.vponto))
                        .font(.system(size: 44, weight: .heavy))
                        .foregroundStyle(Tema.texto)
                    Text("VPONTO").font(.caption2.weight(.bold)).foregroundStyle(Tema.textoSuave)
                }
            }
            .frame(width: 130, height: 130)

            VStack(alignment: .leading, spacing: 6) {
                Text("Em uso há \(p.diasDesdeMudanca) \(p.diasDesdeMudanca == 1 ? "dia" : "dias")")
                    .font(.headline).foregroundStyle(Tema.texto)
                Text(p.origem).font(.footnote).foregroundStyle(Tema.textoSuave)
                if let m = p.medianaFc {
                    Text("Treinos pela FC: \(numero(m))").font(.footnote.weight(.medium)).foregroundStyle(Tema.azul)
                }
                Text("FC máxima de referência: \(Int(p.fcMaxima)) bpm").font(.caption).foregroundStyle(Tema.textoSuave)
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(colors: [Tema.lima.opacity(0.55), Tema.aqua.opacity(0.28), Color.white], startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 22)
        )
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(Tema.aqua.opacity(0.3), lineWidth: 1))
    }
}

private struct AvisoSugestao: View {
    let s: PainelVpontoApp.Sugestao
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label("Sugestão: VPONTO \(Int(s.vponto))", systemImage: "arrow.up.right.circle.fill")
                .font(.headline).foregroundStyle(Tema.laranja)
            Text(s.texto).font(.subheadline).foregroundStyle(Tema.texto)
            Text("Para aplicar, use a página VPONTO e zonas no site.").font(.caption).foregroundStyle(Tema.textoSuave)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Tema.laranja.opacity(0.12), in: RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - Zonas (faixas de pace) com os ritmos-chave

private struct GraficoZonas: View {
    let p: PainelVpontoApp
    @State private var zonaSel: String?

    private var cores: [String: Color] {
        Dictionary(uniqueKeysWithValues: zip(p.zonas.map(\.id), Zona.allCases.map(\.cor)))
    }

    var body: some View {
        // o eixo é invertido (mais rápido à direita): plota -pace e escreve o pace nos rótulos
        let lento = (p.zonas.map(\.lentoSeg).max() ?? 435) + 10
        let rapido = (p.zonas.map(\.rapidoSeg).min() ?? 230) - 10
        Secao(titulo: "Zonas de ritmo", icone: "speedometer", tom: Tema.aqua) {
            Chart {
                ForEach(p.zonas) { z in
                    BarMark(
                        xStart: .value("lento", -z.lentoSeg),
                        xEnd: .value("rápido", -z.rapidoSeg),
                        y: .value("zona", z.id),
                        height: .fixed(22)
                    )
                    .foregroundStyle((cores[z.id] ?? Tema.azul).opacity(zonaSel == nil || zonaSel == z.id ? 1 : 0.35))
                    .cornerRadius(6)
                }
                // ritmos-chave como marcadores sobre as faixas
                ForEach(p.ritmosChave) { r in
                    RuleMark(x: .value("pace", -r.paceSeg), yStart: .value("a", "Z1"), yEnd: .value("b", "Z6"))
                        .foregroundStyle(Tema.texto.opacity(0.28))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 3]))
                        .annotation(position: .top, spacing: 2) {
                            Text(r.letra).font(.caption2.weight(.heavy)).foregroundStyle(Tema.texto)
                        }
                }
            }
            .chartYScale(domain: p.zonas.map(\.id))
            .chartYAxis {
                AxisMarks { v in
                    AxisValueLabel { if let s = v.as(String.self) { Text(s).font(.caption.weight(.bold)) } }
                }
            }
            .chartXScale(domain: -lento ... -rapido)
            .chartXAxis {
                AxisMarks(values: .automatic(desiredCount: 6)) { v in
                    AxisGridLine()
                    AxisValueLabel { if let d = v.as(Double.self) { Text(formatarPace(-d)).font(.caption2) } }
                }
            }
            .frame(height: 230)

            ForEach(p.zonas) { z in
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Circle().fill(cores[z.id] ?? Tema.azul).frame(width: 10, height: 10)
                    VStack(alignment: .leading, spacing: 1) {
                        HStack {
                            Text("\(z.id) \(z.nome)").font(.subheadline.weight(.semibold)).foregroundStyle(Tema.texto)
                            Spacer()
                            Text("\(formatarPace(z.lentoSeg))–\(formatarPace(z.rapidoSeg)) /km")
                                .font(.subheadline.weight(.medium)).monospacedDigit().foregroundStyle(Tema.texto)
                        }
                        Text(z.uso).font(.caption).foregroundStyle(Tema.textoSuave)
                    }
                }
            }
        }
    }
}

// MARK: - F, M, L, I, R

private struct BlocoRitmosChave: View {
    let p: PainelVpontoApp

    private func cor(_ letra: String) -> Color {
        switch letra {
        case "F": Zona.z2.cor
        case "M": Zona.z3.cor
        case "L": Zona.z4.cor
        case "I": Zona.z5.cor
        default: Zona.z6.cor
        }
    }

    var body: some View {
        Secao(titulo: "Ritmos-chave do livro", icone: "target", tom: Tema.roxo) {
            Text("O ritmo que define cada tipo de treino de Daniels para o seu VPONTO.")
                .font(.footnote).foregroundStyle(Tema.textoSuave)
            ForEach(p.ritmosChave) { r in
                HStack(spacing: 12) {
                    Text(r.letra)
                        .font(.title3.weight(.heavy))
                        .foregroundStyle(.white)
                        .frame(width: 38, height: 38)
                        .background(cor(r.letra), in: RoundedRectangle(cornerRadius: 10))
                    VStack(alignment: .leading, spacing: 1) {
                        Text(r.nome).font(.subheadline.weight(.semibold)).foregroundStyle(Tema.texto)
                        Text(r.uso).font(.caption).foregroundStyle(Tema.textoSuave)
                    }
                    Spacer()
                    Text(r.letra == "R" ? "\(Int((r.paceSeg / 2.5).rounded())) s / 400 m" : "\(formatarPace(r.paceSeg)) /km")
                        .font(.headline).monospacedDigit().foregroundStyle(Tema.texto)
                }
            }
        }
    }
}

// MARK: - Evolução do VPONTO

private struct GraficoEvolucao: View {
    let p: PainelVpontoApp
    @State private var selecionada: Date?

    private var todos: [Double] { p.provas.map(\.vponto) + p.porFc.map(\.vponto) + [p.vponto] }

    private var provaSel: PainelVpontoApp.Prova? {
        guard let d = selecionada else { return nil }
        return p.provas.min { abs(data($0.data).timeIntervalSince(d)) < abs(data($1.data).timeIntervalSince(d)) }
    }

    var body: some View {
        let lo = (todos.min() ?? 38).rounded(.down) - 1
        let hi = (todos.max() ?? 46).rounded(.up) + 1
        Secao(titulo: "VPONTO nas provas", icone: "flag.checkered", tom: Tema.azul) {
            Group {
                if let s = provaSel {
                    HStack(spacing: 10) {
                        Text(s.nome).font(.subheadline.weight(.bold)).foregroundStyle(Tema.texto).lineLimit(1)
                        Text(curta(s.data)).foregroundStyle(Tema.textoSuave)
                        Text(formatarDuracao(s.tempoSeg)).foregroundStyle(Tema.texto)
                        Text("VPONTO \(numero(s.vponto))").foregroundStyle(Tema.azul)
                    }
                    .font(.subheadline.weight(.semibold)).monospacedDigit()
                } else {
                    Text("Provas (azul) e estimativa pela FC dos treinos (cinza). Toque numa prova.")
                        .font(.caption).foregroundStyle(Tema.textoSuave)
                }
            }
            .frame(minHeight: 22, alignment: .leading)

            Chart {
                RuleMark(y: .value("em uso", p.vponto))
                    .foregroundStyle(Tema.laranja.opacity(0.8))
                    .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
                    .annotation(position: .top, alignment: .trailing, spacing: 2) {
                        Text("em uso \(Int(p.vponto))").font(.caption2.weight(.bold)).foregroundStyle(Tema.laranja)
                    }
                ForEach(p.porFc) { e in
                    PointMark(x: .value("data", data(e.data)), y: .value("VPONTO", e.vponto))
                        .foregroundStyle(Tema.cinzaPausa.opacity(0.55))
                        .symbolSize(28)
                }
                ForEach(p.provas) { r in
                    LineMark(x: .value("data", data(r.data)), y: .value("VPONTO", r.vponto), series: .value("s", "provas"))
                        .foregroundStyle(Tema.azul.opacity(0.5))
                        .interpolationMethod(.monotone)
                    PointMark(x: .value("data", data(r.data)), y: .value("VPONTO", r.vponto))
                        .foregroundStyle(Tema.azul)
                        .symbolSize(provaSel?.id == r.id ? 140 : 70)
                }
                if let s = selecionada {
                    RuleMark(x: .value("data", s)).foregroundStyle(Tema.texto.opacity(0.3))
                }
            }
            .chartXSelection(value: $selecionada)
            .chartYScale(domain: lo ... hi)
            .chartXAxis {
                AxisMarks(values: .stride(by: .month, count: 2)) { v in
                    AxisGridLine()
                    AxisValueLabel { if let d = v.as(Date.self) { Text(d.formatted(.dateTime.month(.abbreviated).locale(Locale(identifier: "pt_BR")))).font(.caption2) } }
                }
            }
            .frame(height: 200)
        }
    }
}

// MARK: - Evolução do atleta

private enum VisaoEvolucao: String, CaseIterable, Identifiable {
    case volume = "Volume"
    case intensidade = "Intensidade"
    case eficiencia = "Eficiência"
    case vponto = "VPONTO"
    var id: String { rawValue }
}

private let gruposZona = ["Fácil", "Maratona", "Limiar", "Intervalado", "Repetição"]

private struct LinhaGrupo: Identifiable {
    let semana: Date
    let grupo: String
    let km: Double
    var id: String { "\(semana.timeIntervalSince1970)-\(grupo)" }
}

private func dataDoMes(_ mes: String) -> Date {
    formatadorData.date(from: mes + "-15") ?? Date()
}

private struct BlocoEvolucaoAtleta: View {
    let e: Evolucao
    let vpontoEmUso: Double
    @State private var visao: VisaoEvolucao = .volume
    @State private var semanaSel: Date?

    private var coresGrupo: [Color] { [Zona.z2.cor, Zona.z3.cor, Zona.z4.cor, Zona.z5.cor, Zona.z6.cor] }

    private func linhas(_ semanas: [Evolucao.Semana]) -> [LinhaGrupo] {
        semanas.flatMap { s -> [LinhaGrupo] in
            let d = data(s.inicio)
            return [
                LinhaGrupo(semana: d, grupo: "Fácil", km: s.facilKm),
                LinhaGrupo(semana: d, grupo: "Maratona", km: s.maratonaKm),
                LinhaGrupo(semana: d, grupo: "Limiar", km: s.limiarKm),
                LinhaGrupo(semana: d, grupo: "Intervalado", km: s.intervaladoKm),
                LinhaGrupo(semana: d, grupo: "Repetição", km: s.repeticaoKm),
            ]
        }
    }

    private var semanaSelecionada: Evolucao.Semana? {
        guard let d = semanaSel else { return nil }
        return e.semanas.min { abs(data($0.inicio).timeIntervalSince(d)) < abs(data($1.inicio).timeIntervalSince(d)) }
    }

    private func eixoSemanas() -> some AxisContent {
        AxisMarks(values: .stride(by: .month)) { v in
            AxisGridLine()
            AxisValueLabel { if let d = v.as(Date.self) { Text(d.formatted(.dateTime.month(.abbreviated).locale(Locale(identifier: "pt_BR")))).font(.caption2) } }
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Secao(titulo: "Evolução do atleta", icone: "chart.line.uptrend.xyaxis", tom: Tema.laranja) {
                Picker("Visão", selection: $visao) {
                    ForEach(VisaoEvolucao.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)

                switch visao {
                case .volume: volume
                case .intensidade: intensidade
                case .eficiencia: eficiencia
                case .vponto: vpontoMensal
                }
            }

            Criterios(
                titulo: "Critérios de Daniels",
                icone: "checklist",
                tom: Tema.azul,
                subtitulo: "Últimas 4 semanas completas, só treino (provas ficam de fora). Limites da Tabela 2.1 do livro.",
                itens: e.criteriosDaniels
            )
            Criterios(
                titulo: "Indicadores no estilo Canova",
                icone: "figure.run",
                tom: Tema.roxo,
                subtitulo: "Canova não publica limites numéricos como Daniels: estes indicadores seguem os princípios dele (volume por ciclos, trabalho específico, longão).",
                itens: e.indicadoresCanova
            )
        }
    }

    // MARK: volume por zona

    private var volume: some View {
        VStack(alignment: .leading, spacing: 8) {
            Group {
                if let s = semanaSelecionada {
                    HStack(spacing: 10) {
                        Text("Sem. \(curta(s.inicio))").font(.subheadline.weight(.bold)).foregroundStyle(Tema.texto)
                        Text("\(numero(s.km)) km").foregroundStyle(Tema.azul)
                        Text("longão \(numero(s.longaoKm)) km").foregroundStyle(Tema.textoSuave)
                        Text("\(s.corridas) corr.").foregroundStyle(Tema.textoSuave)
                    }
                    .font(.subheadline.weight(.semibold)).monospacedDigit()
                } else {
                    Text("Quilômetros por semana, divididos pelas zonas de ritmo. Toque numa semana.")
                        .font(.caption).foregroundStyle(Tema.textoSuave)
                }
            }
            .frame(minHeight: 22, alignment: .leading)

            Chart {
                ForEach(linhas(e.semanas)) { l in
                    BarMark(x: .value("semana", l.semana, unit: .weekOfYear), y: .value("km", l.km))
                        .foregroundStyle(by: .value("zona", l.grupo))
                        .opacity(semanaSel == nil || semanaSelecionada.map({ data($0.inicio) == l.semana }) == true ? 1 : 0.4)
                }
            }
            .chartForegroundStyleScale(domain: gruposZona, range: coresGrupo)
            .chartXSelection(value: $semanaSel)
            .chartXAxis { eixoSemanas() }
            .chartLegend(position: .bottom, spacing: 8)
            .frame(height: 220)
            Text("A última barra é a semana em andamento, ainda incompleta.")
                .font(.caption2).foregroundStyle(Tema.textoSuave)
        }
    }

    // MARK: distribuição de intensidade

    private var intensidade: some View {
        let ultimas = Array(e.semanas.suffix(12))
        let total = ultimas.reduce(0) { $0 + $1.km }
        let facil = ultimas.reduce(0) { $0 + $1.facilKm }
        return VStack(alignment: .leading, spacing: 8) {
            Text("Como o volume se divide entre as zonas, semana a semana (últimas 12). \(Int((total > 0 ? facil / total * 100 : 0).rounded()))% foi corrida fácil (Z1–Z2).")
                .font(.caption).foregroundStyle(Tema.textoSuave)
            Chart {
                ForEach(linhas(ultimas)) { l in
                    BarMark(x: .value("semana", l.semana, unit: .weekOfYear), y: .value("km", l.km), stacking: .normalized)
                        .foregroundStyle(by: .value("zona", l.grupo))
                }
            }
            .chartForegroundStyleScale(domain: gruposZona, range: coresGrupo)
            .chartYAxis {
                AxisMarks(values: [0, 0.25, 0.5, 0.75, 1]) { v in
                    AxisGridLine()
                    AxisValueLabel { if let d = v.as(Double.self) { Text("\(Int(d * 100))%").font(.caption2) } }
                }
            }
            .chartXAxis { eixoSemanas() }
            .chartLegend(position: .bottom, spacing: 8)
            .frame(height: 220)
        }
    }

    // MARK: eficiência aeróbia

    private var eficiencia: some View {
        let faixa = e.faixaFc.count == 2 ? "\(Int(e.faixaFc[0]))–\(Int(e.faixaFc[1]))" : "145–155"
        let valores = e.eficiencia.map(\.valor)
        let lo = ((valores.min() ?? 300) / 10).rounded(.down) * 10 - 10
        let hi = ((valores.max() ?? 380) / 10).rounded(.up) * 10 + 10
        return VStack(alignment: .leading, spacing: 8) {
            Text("Pace médio nos km corridos com a FC entre \(faixa) bpm. Se o ponto sobe, você corre mais rápido com o mesmo esforço cardíaco: é a melhor medida de evolução aeróbia.")
                .font(.caption).foregroundStyle(Tema.textoSuave)
            if e.eficiencia.count >= 2 {
                Chart {
                    ForEach(e.eficiencia) { m in
                        LineMark(x: .value("mês", dataDoMes(m.mes)), y: .value("pace", -m.valor))
                            .foregroundStyle(Tema.aqua)
                            .interpolationMethod(.monotone)
                        PointMark(x: .value("mês", dataDoMes(m.mes)), y: .value("pace", -m.valor))
                            .foregroundStyle(Tema.aqua)
                            .symbolSize(60)
                            .annotation(position: .top, spacing: 3) {
                                Text(formatarPace(m.valor)).font(.caption2.weight(.semibold)).foregroundStyle(Tema.texto)
                            }
                    }
                }
                .chartYScale(domain: -hi ... -lo)
                .chartYAxis {
                    AxisMarks { v in
                        AxisGridLine()
                        AxisValueLabel { if let d = v.as(Double.self) { Text(formatarPace(-d)).font(.caption2) } }
                    }
                }
                .chartXAxis {
                    AxisMarks(values: .stride(by: .month)) { v in
                        AxisValueLabel { if let d = v.as(Date.self) { Text(d.formatted(.dateTime.month(.narrow).locale(Locale(identifier: "pt_BR")))).font(.caption2) } }
                    }
                }
                .frame(height: 210)
            } else {
                Text("Ainda não há corridas suficientes nessa faixa de FC.").font(.footnote).foregroundStyle(Tema.textoSuave)
            }
        }
    }

    // MARK: VPONTO mês a mês

    private var vpontoMensal: some View {
        let valores = e.vpontoMensal.map(\.valor) + [vpontoEmUso]
        let lo = (valores.min() ?? 38).rounded(.down) - 1
        let hi = (valores.max() ?? 46).rounded(.up) + 1
        return VStack(alignment: .leading, spacing: 8) {
            Text("O melhor esforço de 8 km seguidos em treino em cada mês, convertido em VPONTO. É um piso: treino quase nunca é esforço máximo, então só confirma que o valor em uso não está inflado.")
                .font(.caption).foregroundStyle(Tema.textoSuave)
            if e.vpontoMensal.count >= 2 {
                Chart {
                    RuleMark(y: .value("em uso", vpontoEmUso))
                        .foregroundStyle(Tema.laranja.opacity(0.8))
                        .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
                        .annotation(position: .top, alignment: .trailing, spacing: 2) {
                            Text("em uso \(Int(vpontoEmUso))").font(.caption2.weight(.bold)).foregroundStyle(Tema.laranja)
                        }
                    ForEach(e.vpontoMensal) { m in
                        LineMark(x: .value("mês", dataDoMes(m.mes)), y: .value("VPONTO", m.valor))
                            .foregroundStyle(Tema.azul)
                            .interpolationMethod(.monotone)
                        PointMark(x: .value("mês", dataDoMes(m.mes)), y: .value("VPONTO", m.valor))
                            .foregroundStyle(Tema.azul)
                            .symbolSize(60)
                            .annotation(position: .bottom, spacing: 3) {
                                Text(numero(m.valor)).font(.caption2.weight(.semibold)).foregroundStyle(Tema.texto)
                            }
                    }
                }
                .chartYScale(domain: lo ... hi)
                .chartXAxis {
                    AxisMarks(values: .stride(by: .month)) { v in
                        AxisValueLabel { if let d = v.as(Date.self) { Text(d.formatted(.dateTime.month(.narrow).locale(Locale(identifier: "pt_BR")))).font(.caption2) } }
                    }
                }
                .frame(height: 210)
            } else {
                Text("Ainda não há dados suficientes.").font(.footnote).foregroundStyle(Tema.textoSuave)
            }
        }
    }
}

private struct Criterios: View {
    let titulo: String
    var icone: String = "checklist"
    var tom: Color = Tema.azul
    let subtitulo: String
    let itens: [Evolucao.Criterio]

    private func icone(_ status: String) -> (String, Color) {
        switch status {
        case "ok": ("checkmark.circle.fill", Tema.aqua)
        case "atencao": ("exclamationmark.triangle.fill", Tema.laranja)
        default: ("info.circle.fill", Tema.cinzaPausa)
        }
    }

    var body: some View {
        Secao(titulo: titulo, icone: icone, tom: tom) {
            Text(subtitulo).font(.footnote).foregroundStyle(Tema.textoSuave)
            ForEach(itens) { c in
                let (nome, cor) = icone(c.status)
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: nome).foregroundStyle(cor).font(.title3).frame(width: 26)
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(c.titulo).font(.subheadline.weight(.semibold)).foregroundStyle(Tema.texto)
                            Spacer(minLength: 8)
                            Text(c.valor).font(.headline).monospacedDigit().foregroundStyle(Tema.texto)
                        }
                        Text(c.referencia).font(.caption.weight(.medium)).foregroundStyle(Tema.textoSuave)
                        Text(c.detalhe).font(.caption).foregroundStyle(Tema.textoSuave)
                    }
                }
                if c.id != itens.last?.id { Divider() }
            }
        }
    }
}

// MARK: - Previsões de prova

private struct BlocoPrevisoes: View {
    let p: PainelVpontoApp

    var body: some View {
        Secao(titulo: "Previsão de prova", icone: "stopwatch.fill", tom: Tema.aqua) {
            Text("Quanto o seu VPONTO \(Int(p.vponto)) sustenta em cada distância, em condição boa e preparo específico.")
                .font(.footnote).foregroundStyle(Tema.textoSuave)
            ForEach(p.previsoes) { r in
                HStack {
                    Text(r.nome).font(.subheadline.weight(.semibold)).foregroundStyle(Tema.texto)
                    Spacer()
                    Text("\(formatarPace(r.paceSeg)) /km").font(.caption).monospacedDigit().foregroundStyle(Tema.textoSuave)
                    Text(formatarDuracao(r.tempoSeg))
                        .font(.headline).monospacedDigit().foregroundStyle(Tema.texto)
                        .frame(minWidth: 78, alignment: .trailing)
                }
                if r.id != p.previsoes.last?.id { Divider() }
            }
        }
    }
}

// MARK: - De onde vem o número

private struct BlocoEvidencias: View {
    let p: PainelVpontoApp

    var body: some View {
        Secao(titulo: "De onde vem", icone: "doc.text.magnifyingglass", tom: Tema.azul) {
            Text("PROVAS").font(.caption.weight(.heavy)).foregroundStyle(Tema.azul)
            ForEach(p.provas.sorted { $0.data > $1.data }.prefix(5)) { r in
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(r.nome).font(.subheadline.weight(.semibold)).foregroundStyle(Tema.texto).lineLimit(1)
                        Text("\(curta(r.data)) · \(numero(r.distanciaKm)) km · \(formatarDuracao(r.tempoSeg))")
                            .font(.caption).foregroundStyle(Tema.textoSuave)
                    }
                    Spacer()
                    Text(numero(r.vponto)).font(.title3.weight(.bold)).monospacedDigit().foregroundStyle(Tema.azul)
                }
            }

            if !p.esforcos.isEmpty {
                Divider()
                Text("MELHORES ESFORÇOS EM TREINO (PISO)").font(.caption.weight(.heavy)).foregroundStyle(Tema.textoSuave)
                ForEach(p.esforcos) { e in
                    HStack {
                        VStack(alignment: .leading, spacing: 1) {
                            Text("\(e.km) km seguidos").font(.subheadline.weight(.semibold)).foregroundStyle(Tema.texto)
                            Text("\(curta(e.data)) · \(formatarPace(e.paceSeg)) /km" + (e.fcMedia.map { " · \(Int($0)) bpm" } ?? ""))
                                .font(.caption).foregroundStyle(Tema.textoSuave)
                        }
                        Spacer()
                        Text(numero(e.vponto)).font(.title3.weight(.bold)).monospacedDigit().foregroundStyle(Tema.textoSuave)
                    }
                }
            }

            if p.historico.count > 1 {
                Divider()
                Text("HISTÓRICO DO VALOR EM USO").font(.caption.weight(.heavy)).foregroundStyle(Tema.textoSuave)
                ForEach(p.historico) { h in
                    HStack(alignment: .firstTextBaseline) {
                        Text(curta(h.desde)).font(.caption).monospacedDigit().foregroundStyle(Tema.textoSuave)
                        Text("VPONTO \(numero(h.vponto))").font(.subheadline.weight(.semibold)).foregroundStyle(Tema.texto)
                        Text(h.origem).font(.caption).foregroundStyle(Tema.textoSuave).lineLimit(1)
                    }
                }
            }
        }
    }
}

private struct BlocoComoFunciona: View {
    let p: PainelVpontoApp

    var body: some View {
        Secao(titulo: "Como funciona", icone: "lightbulb.fill", tom: Tema.laranja) {
            Text("O VPONTO resume a sua forma num número. Ele sai de um desempenho recente em prova (tempo e distância) e dele vêm todas as zonas e os ritmos de treino.")
            Text("Treinos servem de conferência: o melhor esforço sustentado é um piso, e a FC dá uma estimativa que oscila de corrida para corrida.")
            Text("O livro manda manter o mesmo valor por 3 a 6 semanas e só mudar com uma prova melhor, ou com treinos ficando mais fáceis no mesmo ritmo. A mudança é aplicada na página VPONTO e zonas, no site.")
        }
        .font(.subheadline)
        .foregroundStyle(Tema.textoSuave)
    }
}
