import SwiftUI

/// Zonas de ritmo do Marcio (Canova + Daniels). Mesmas de app/lib/zonas-pace.ts.
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
        switch self {
        case .z1: "7:15–6:30"
        case .z2: "6:30–5:45"
        case .z3: "5:45–5:05"
        case .z4: "5:05–4:40"
        case .z5: "4:40–4:15"
        case .z6: "4:15–3:50"
        }
    }

    var kmh: ClosedRange<Double> {
        switch self {
        case .z1: 8.28...9.23
        case .z2: 9.23...10.43
        case .z3: 10.43...11.80
        case .z4: 11.80...12.86
        case .z5: 12.86...14.12
        case .z6: 14.12...15.65
        }
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
    case leve, limiar, tiros, longao, prova

    var rotulo: String {
        switch self {
        case .leve: "Rodagem leve"
        case .limiar: "Limiar"
        case .tiros: "Tiros"
        case .longao: "Longão"
        case .prova: "Prova"
        }
    }

    var icone: String {
        switch self {
        case .leve: "figure.walk"
        case .limiar: "gauge.with.dots.needle.67percent"
        case .tiros: "bolt.fill"
        case .longao: "figure.run"
        case .prova: "flag.checkered"
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
    var aquecimento: Etapa?
    var blocos: [Bloco]
    var desaquecimento: Etapa?

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

enum SemanaExemplo {
    /// Semana de exemplo (terça, quinta, sábado, domingo) a partir da segunda-feira da semana atual.
    static func sessoes(referencia: Date = Date()) -> [Sessao] {
        var cal = Calendar(identifier: .gregorian)
        cal.firstWeekday = 2
        let segunda = cal.dateInterval(of: .weekOfYear, for: referencia)!.start
        func dia(_ n: Int) -> String {
            let d = cal.date(byAdding: .day, value: n, to: segunda)!
            let f = DateFormatter()
            f.calendar = cal
            f.dateFormat = "yyyy-MM-dd"
            return f.string(from: d)
        }
        let aq = Etapa(papel: .aquecimento, distanciaM: nil, tempoSeg: 600, zona: .z1)
        let des = Etapa(papel: .desaquecimento, distanciaM: nil, tempoSeg: 600, zona: .z1)

        return [
            Sessao(
                id: "ex-\(dia(1))", data: dia(1), titulo: "Rodagem leve 8 km", tipo: .leve,
                aquecimento: nil,
                blocos: [Bloco(repeticoes: 1, etapas: [Etapa(papel: .trabalho, distanciaM: 8000, tempoSeg: nil, zona: .z2)])],
                desaquecimento: nil),
            Sessao(
                id: "ex-\(dia(3))", data: dia(3), titulo: "Limiar 3 × 2 km", tipo: .limiar,
                aquecimento: aq,
                blocos: [Bloco(repeticoes: 3, etapas: [
                    Etapa(papel: .trabalho, distanciaM: 2000, tempoSeg: nil, zona: .z4),
                    Etapa(papel: .recuperacao, distanciaM: nil, tempoSeg: 120, zona: .z1),
                ])],
                desaquecimento: des),
            Sessao(
                id: "ex-\(dia(5))", data: dia(5), titulo: "Tiros 6 × 800 m", tipo: .tiros,
                aquecimento: aq,
                blocos: [Bloco(repeticoes: 6, etapas: [
                    Etapa(papel: .trabalho, distanciaM: 800, tempoSeg: nil, zona: .z5),
                    Etapa(papel: .recuperacao, distanciaM: nil, tempoSeg: 120, zona: .z1),
                ])],
                desaquecimento: des),
            Sessao(
                id: "ex-\(dia(6))", data: dia(6), titulo: "Longão 18 km", tipo: .longao,
                aquecimento: nil,
                blocos: [Bloco(repeticoes: 1, etapas: [Etapa(papel: .trabalho, distanciaM: 18000, tempoSeg: nil, zona: .z2)])],
                desaquecimento: nil),
        ]
    }
}
