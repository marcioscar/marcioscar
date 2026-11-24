import CoreLocation
import Foundation

// Modelos do que a rota /api/corridas-relogio devolve (resultados das corridas lidas do Apple Watch).

struct ResumoCorrida: Codable, Identifiable, Hashable {
    var id: String
    var nome: String
    var dataInicio: String
    var distanciaM: Double
    var tempoSeg: Double
    var paceSegKm: Double?
    var fcMedia: Double?
    var tipoSessao: String?
    /// corrida, caminhada, forca ou outro (só no que vem direto do app Saúde)
    var tipo: String? = nil
    /// símbolo SF do tipo de treino
    var icone: String? = nil

    var ehCorrida: Bool { (tipo ?? "corrida") == "corrida" }
    var temPace: Bool { tipo == nil || tipo == "corrida" || tipo == "caminhada" }

    var data: Date { ISO8601DateFormatter.comFracao.date(from: dataInicio) ?? ISO8601DateFormatter().date(from: dataInicio) ?? Date() }
}

struct ListaCorridas: Codable { var corridas: [ResumoCorrida] }

struct PontoSerie: Codable, Identifiable {
    var km: Double
    var pace: Double?
    var fc: Double?
    var alt: Double?
    var id: Double { km }
}

struct SplitKm: Codable, Identifiable {
    var km: Int
    var distanciaM: Double
    var tempoSeg: Double
    var fcMedia: Double?
    var id: Int { km }
    var paceSegKm: Double? { distanciaM >= 150 ? tempoSeg / (distanciaM / 1000) : nil }
}

struct VoltaResultado: Codable, Identifiable {
    var rotulo: String
    var distanciaM: Double
    var tempoSeg: Double
    var fcMedia: Double?
    var potenciaW: Double?
    var cadencia: Double?
    var id: String { "\(rotulo)-\(distanciaM)-\(tempoSeg)" }
}

struct LinhaZonaResultado: Codable, Identifiable {
    var id: String
    var nome: String
    var faixa: String
    var pct: Double
    var seg: Double
    var ordem: Int
}

struct ZonasResultado: Codable {
    var pace: [LinhaZonaResultado]?
    var fc: [LinhaZonaResultado]?
    var fcMaxima: Double
}

struct LinhaComparacao: Codable, Identifiable {
    var chave: String
    var rotulo: String
    var papel: String
    var meta: String
    var distanciaM: Double
    var tempoSeg: Double
    var planRapidoSeg: Double?
    var planLentoSeg: Double?
    var zona: Int?
    var execSeg: Double?
    var status: String
    var diffSeg: Double?
    var id: String { chave }
}

struct ResumoComparacao: Codable {
    var avaliadas: Int
    var dentro: Int
    var rapidas: Int
    var lentas: Int
    var desvioMedioSeg: Double?
}

struct ComparacaoResultado: Codable {
    var base: String
    var linhas: [LinhaComparacao]
    var resumo: ResumoComparacao
}

struct PlanejadoResultado: Codable {
    var titulo: String
    var texto: String
}

struct MetricasResultado: Codable {
    var fcMedia: Double?
    var fcMaxima: Double?
    var caloriasKcal: Double?
    var cadencia: Double?
    var potenciaW: Double?
    var passadaM: Double?
    var oscilacaoCm: Double?
    var contatoMs: Double?
}

struct AnaliseIA: Codable {
    var tipoSessao: String
    var avaliacao: String
    var resumo: String
    var pontosPositivos: [String]
    var pontosAtencao: [String]
    var alinhamentoCanova: String?
    var recomendacao: String
    var metricasRelogio: String?
    var comparacaoTreinus: String?
}

struct ResultadoCorrida: Codable {
    var id: String
    var nome: String
    var dataInicio: String
    var distanciaM: Double
    var tempoSeg: Double
    var duracaoTotalSeg: Double
    var elevacaoGanhoM: Double?
    var paceSegKm: Double?
    var metricas: MetricasResultado
    var polyline: String?
    var serie: [PontoSerie]
    var splits: [SplitKm]
    var voltas: [VoltaResultado]
    var zonas: ZonasResultado
    var planejado: PlanejadoResultado?
    var comparacao: ComparacaoResultado?
    var analise: AnaliseIA?
    var analisadaEm: String?
    /// velocidade (m/s) de cada ponto da rota, na mesma ordem da polyline; só no resultado montado no iPhone
    var velocidades: [Double]? = nil

    var data: Date { ISO8601DateFormatter.comFracao.date(from: dataInicio) ?? ISO8601DateFormatter().date(from: dataInicio) ?? Date() }

    /// Rota decodificada (Google Encoded Polyline, precisão 5).
    var coordenadas: [CLLocationCoordinate2D] { PolylineDecoder.decodificar(polyline ?? "") }
}

enum PolylineDecoder {
    static func decodificar(_ codificado: String) -> [CLLocationCoordinate2D] {
        let bytes = Array(codificado.utf8)
        var i = 0, lat = 0, lng = 0
        var saida: [CLLocationCoordinate2D] = []

        func proximo() -> Int? {
            var resultado = 0, deslocamento = 0
            while i < bytes.count {
                let b = Int(bytes[i]) - 63
                i += 1
                resultado |= (b & 0x1f) << deslocamento
                deslocamento += 5
                if b < 0x20 { return (resultado & 1) != 0 ? ~(resultado >> 1) : (resultado >> 1) }
            }
            return nil
        }

        while i < bytes.count {
            guard let dLat = proximo(), let dLng = proximo() else { break }
            lat += dLat
            lng += dLng
            saida.append(CLLocationCoordinate2D(latitude: Double(lat) / 1e5, longitude: Double(lng) / 1e5))
        }
        return saida
    }
}

func formatarPace(_ seg: Double?) -> String {
    guard let seg, seg > 0 else { return "—" }
    let t = Int(seg.rounded())
    return "\(t / 60):" + String(format: "%02d", t % 60)
}

func formatarDuracao(_ seg: Double) -> String {
    let t = Int(seg.rounded())
    let h = t / 3600, m = (t % 3600) / 60, s = t % 60
    return h > 0 ? "\(h):" + String(format: "%02d:%02d", m, s) : "\(m):" + String(format: "%02d", s)
}
