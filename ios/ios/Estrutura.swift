import SwiftUI

extension Sessao {
    /// Todas as etapas na ordem em que acontecem, repetindo os blocos.
    var etapasExpandidas: [Etapa] {
        var r: [Etapa] = []
        if let a = aquecimento { r.append(a) }
        for b in blocos { for _ in 0..<max(b.repeticoes, 1) { r.append(contentsOf: b.etapas) } }
        if let d = desaquecimento { r.append(d) }
        return r
    }

    private func velocidadeMedia(_ e: Etapa) -> Double {
        if let f = e.faixaKmh { return (f.lowerBound + f.upperBound) / 2 }
        return 9.5
    }

    /// Distância estimada (m) de uma etapa; tempo vira distância pela velocidade média da faixa.
    func metros(_ e: Etapa) -> Double {
        if let d = e.distanciaM { return d }
        if let t = e.tempoSeg { return velocidadeMedia(e) / 3.6 * t }
        return 0
    }

    func segundos(_ e: Etapa) -> Double {
        if let t = e.tempoSeg { return t }
        // série de musculação sem meta: ~40 s de execução
        if ehMusculacao, e.papel == .trabalho, e.distanciaM == nil { return 40 }
        if let d = e.distanciaM { return d / (velocidadeMedia(e) / 3.6) }
        return 0
    }

    var distanciaKm: Double { etapasExpandidas.reduce(0) { $0 + metros($1) } / 1000 }
    var duracaoMin: Int { Int((etapasExpandidas.reduce(0) { $0 + segundos($1) } / 60).rounded()) }

    var esforco: String {
        if ehMusculacao { return "Força" }
        let zs = etapasExpandidas.filter { $0.papel == .trabalho }.compactMap { $0.zona?.rawValue }
        switch zs.max() ?? 2 {
        case ...2: return "Leve"
        case 3: return "Moderado"
        case 4: return "Forte"
        default: return "Alto"
        }
    }

    /// Pace do trabalho principal e da recuperação (primeiro bloco), para o cartão de hoje.
    var paceTrabalho: String? { blocos.first?.etapas.first(where: { $0.papel == .trabalho })?.textoPace }
    var resumoTrabalho: String? {
        guard let b = blocos.first, let e = b.etapas.first(where: { $0.papel == .trabalho }) else { return nil }
        return b.repeticoes > 1 ? "\(b.repeticoes) × \(e.descricaoMeta)" : e.descricaoMeta
    }

    /// distância da corrida, ou a contagem de exercícios na musculação
    var kmTexto: String {
        if ehMusculacao { return "\(blocos.count) exercícios" }
        return String(format: "%.1f km", distanciaKm).replacingOccurrences(of: ".", with: ",")
    }

    var duracaoTexto: String {
        let h = duracaoMin / 60, m = duracaoMin % 60
        return h > 0 ? "\(h) h \(String(format: "%02d", m))" : "~\(duracaoMin) min"
    }
}

/// Perfil do treino: uma barra por etapa, altura pela intensidade, largura pela distância.
struct GraficoEstrutura: View {
    let sessao: Sessao
    var altura: CGFloat = 72

    var body: some View {
        let etapas = sessao.etapasExpandidas
        let total = max(etapas.reduce(0) { $0 + sessao.metros($1) }, 1)
        GeometryReader { geo in
            let espaco: CGFloat = 3
            let util = geo.size.width - espaco * CGFloat(max(etapas.count - 1, 0))
            HStack(alignment: .bottom, spacing: espaco) {
                ForEach(Array(etapas.enumerated()), id: \.offset) { _, e in
                    let largura = max(util * CGFloat(sessao.metros(e) / total), 5)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(e.papel.cor)
                        .frame(width: largura, height: altura * alturaRelativa(e))
                }
            }
            .frame(maxHeight: .infinity, alignment: .bottom)
        }
        .frame(height: altura)
        .accessibilityHidden(true)
    }

    private func alturaRelativa(_ e: Etapa) -> CGFloat {
        switch e.papel {
        case .aquecimento, .desaquecimento: return 0.22
        case .recuperacao: return 0.16
        case .trabalho:
            let z = e.zona?.rawValue ?? 2
            return CGFloat(0.35 + Double(z) * 0.11)
        }
    }
}
