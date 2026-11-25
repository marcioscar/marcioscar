import SwiftUI

/// Uma zona como o site manda (pace em seg/km).
struct ZonaServidor: Codable {
    var id: String
    var nome: String
    var lentoSeg: Double
    var rapidoSeg: Double
}

/// Limites das zonas Z1–Z6 (pace seg/km, do mais lento ao mais rápido). Vêm do site (derivados do VPONTO) e
/// ficam guardados no aparelho; sem resposta do site vale a tabela do VPONTO 42.
enum TabelaZonas {
    private static let chave = "zonasLimites"
    private static let padrao: [[Double]] = [[435, 375], [375, 340], [340, 305], [305, 285], [285, 265], [265, 230]]

    static var limites: [(lento: Double, rapido: Double)] {
        let salvo = UserDefaults.standard.array(forKey: chave) as? [[Double]]
        let lista = (salvo?.count == 6 && salvo!.allSatisfy { $0.count == 2 }) ? salvo! : padrao
        return lista.map { (lento: $0[0], rapido: $0[1]) }
    }

    static func atualizar(_ zonas: [ZonaServidor]?) {
        guard let zonas, zonas.count == 6 else { return }
        UserDefaults.standard.set(zonas.map { [$0.lentoSeg, $0.rapidoSeg] }, forKey: chave)
    }

    static func rotulo(_ seg: Double) -> String {
        let t = Int(seg.rounded())
        return "\(t / 60):" + String(format: "%02d", t % 60)
    }
}

/// Zonas de ritmo do Marcio, derivadas do VPONTO de Jack Daniels (ver `TabelaZonas`). Mesmas de app/lib/zonas-pace.ts.
enum Zona: Int, Codable, CaseIterable {
    case z1 = 1, z2, z3, z4, z5, z6

    var nome: String {
        switch self {
        case .z1: "Recuperação"
        case .z2: "Fácil"
        case .z3: "Maratona"
        case .z4: "Limiar"
        case .z5: "VO2 máx"
        case .z6: "Velocidade"
        }
    }

    /// pace (mais lento – mais rápido), min/km
    var pace: String {
        let l = TabelaZonas.limites[rawValue - 1]
        return "\(TabelaZonas.rotulo(l.lento))–\(TabelaZonas.rotulo(l.rapido))"
    }

    var kmh: ClosedRange<Double> {
        let l = TabelaZonas.limites[rawValue - 1]
        return (3600 / l.lento)...(3600 / l.rapido)
    }

    var cor: Color {
        switch self {
        case .z1: Color(red: 0.36, green: 0.62, blue: 0.80)
        case .z2: Color(red: 0.25, green: 0.65, blue: 0.45)
        case .z3: Color(red: 0.80, green: 0.68, blue: 0.20)
        case .z4: Color(red: 0.90, green: 0.55, blue: 0.15)
        case .z5: Color(red: 0.85, green: 0.30, blue: 0.25)
        case .z6: Color(red: 0.62, green: 0.25, blue: 0.62)
        }
    }
}

enum PapelEtapa: String, Codable {
    case aquecimento, trabalho, recuperacao, desaquecimento

    var rotulo: String {
        switch self {
        case .aquecimento: "Aquecimento"
        case .trabalho: "Trabalho"
        case .recuperacao: "Recuperação"
        case .desaquecimento: "Desaquecimento"
        }
    }
}

/// Uma etapa: meta por distância OU tempo (nenhuma = aberta) e zona de ritmo opcional.
struct Etapa: Codable, Hashable {
    var papel: PapelEtapa
    var distanciaM: Double?
    var tempoSeg: Double?
    var zona: Zona?
    /// Faixa de pace da etapa em seg/km (rápido ≤ lento). Quando existe, vale mais que a zona.
    var paceRapidoSeg: Double?
    var paceLentoSeg: Double?
    /// Nome da etapa (ex.: exercício da musculação)
    var nome: String?

    /// Faixa de velocidade (km/h) para o alerta do relógio: pace explícito ou, senão, a zona.
    var faixaKmh: ClosedRange<Double>? {
        if let r = paceRapidoSeg, let l = paceLentoSeg, r > 0, l >= r {
            return (3600 / l)...(3600 / r)
        }
        return zona?.kmh
    }

    var textoPace: String? {
        func f(_ seg: Double) -> String {
            let t = Int(seg.rounded())
            return "\(t / 60):" + String(format: "%02d", t % 60)
        }
        if let r = paceRapidoSeg, let l = paceLentoSeg { return "\(f(l))–\(f(r))" }
        return zona?.pace
    }

    var descricaoMeta: String {
        if let d = distanciaM {
            return d >= 1000
                ? String(format: "%.1f km", d / 1000).replacingOccurrences(of: ".", with: ",")
                : "\(Int(d)) m"
        }
        if let t = tempoSeg {
            let min = Int(t) / 60, seg = Int(t) % 60
            return seg == 0 ? "\(min) min" : (min == 0 ? "\(seg) s" : "\(min) min \(seg) s")
        }
        return "livre"
    }
}

/// Repete `etapas` (trabalho + recuperação) `repeticoes` vezes.
struct Bloco: Codable, Hashable {
    var repeticoes: Int
    var etapas: [Etapa]
}

enum TipoSessao: String, Codable {
    case leve, limiar, tiros, longao, prova, musculacao

    var rotulo: String {
        switch self {
        case .leve: "Rodagem leve"
        case .limiar: "Limiar"
        case .tiros: "Tiros"
        case .longao: "Longão"
        case .prova: "Prova"
        case .musculacao: "Musculação"
        }
    }

    var icone: String {
        switch self {
        case .leve: "figure.walk"
        case .limiar: "gauge.with.dots.needle.67percent"
        case .tiros: "bolt.fill"
        case .longao: "figure.run"
        case .prova: "flag.checkered"
        case .musculacao: "dumbbell.fill"
        }
    }
}

/// Formato pensado para vir do planejador do site depois (JSON): hoje usamos uma semana de exemplo.
struct Sessao: Codable, Identifiable, Hashable {
    var id: String
    /// yyyy-MM-dd
    var data: String
    var titulo: String
    var tipo: TipoSessao
    /// "corrida" (padrão) ou "musculacao": define a atividade gravada no relógio
    var atividade: String?
    /// Observação livre (opcional)
    var observacao: String?
    /// "canova" (gerado pelo plano) ou "treinador" (prescrito por ele)
    var origem: String?
    var aquecimento: Etapa?
    var blocos: [Bloco]
    var desaquecimento: Etapa?

    var ehMusculacao: Bool { atividade == "musculacao" || tipo == .musculacao }

    var dataComoDate: Date {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "yyyy-MM-dd"
        return f.date(from: data) ?? Date()
    }

    /// Distância total prevista (só etapas por distância; tempo é estimado por pace médio da zona).
    var resumo: String {
        var totalM = 0.0
        var totalS = 0.0
        func soma(_ e: Etapa, vezes: Int) {
            if let d = e.distanciaM { totalM += d * Double(vezes) }
            if let t = e.tempoSeg {
                totalS += t * Double(vezes)
                let kmh = (e.zona?.kmh.lowerBound ?? 9) + (e.zona?.kmh.upperBound ?? 10)
                totalM += (kmh / 2) / 3.6 * t * Double(vezes)
            }
        }
        if let a = aquecimento { soma(a, vezes: 1) }
        for b in blocos { for e in b.etapas { soma(e, vezes: b.repeticoes) } }
        if let d = desaquecimento { soma(d, vezes: 1) }
        return String(format: "%.1f km", totalM / 1000).replacingOccurrences(of: ".", with: ",")
    }
}

struct SemanaInfo: Codable {
    var inicio: String
    var fim: String
    var numero: Int
    var totalSemanas: Int
    var fase: String
}

struct ProvaInfo: Codable {
    var nome: String
    var paceAlvo: String
}

struct RespostaSemana: Codable {
    var semana: SemanaInfo?
    var prova: ProvaInfo?
    var sessoes: [Sessao]
    var aviso: String?
    /// zonas em uso no site (derivadas do VPONTO)
    var zonas: [ZonaServidor]?
    var vponto: Double?
}
