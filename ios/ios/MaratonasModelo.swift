import CoreLocation
import SwiftUI

// MARK: - Resposta de GET /api/maratonas

struct PainelMaratonas: Codable {
    struct Proxima: Codable {
        var nome: String
        var data: String
    }
    var maratonas: [Maratona]
    var proxima: Proxima?
    var vpontoAtual: Double
    var previsaoSeg: Double
}

struct Maratona: Codable, Identifiable, Hashable {
    struct Leitura: Codable, Hashable {
        var primeiraMetadeSeg: Double
        var segundaMetadeSeg: Double
        var diferencaSeg: Double
        var tipo: String
        var kmQueda: Int?
        var paceBaseSeg: Double?
    }
    struct Preparo: Codable, Hashable {
        var km: Double
        var corridas: Int
        var longaoKm: Double
        var longoes30: Int
        var semanasKm: [Double]
    }

    var id: String
    var stravaId: Int
    var numero: Int
    var nome: String
    var data: String
    /// instante da largada (ISO); nil nas provas sem GPS
    var inicio: String?
    var cidade: String?
    var pais: String?
    var codigoPais: String?
    var lat: Double?
    var lng: Double?
    var tempoSeg: Double
    var paceSeg: Double
    var distanciaGpsM: Double?
    var gpsImpreciso: Bool
    var elevacaoM: Double?
    var fcMedia: Double?
    var fcMaxima: Double?
    var calorias: Double?
    var temperatura: Double?
    var polyline: String?
    var totalFotos: Int
    var vponto: Double
    /// tempo acumulado (seg) em cada km oficial, de 1 a 42
    var tempoKm: [Double]?
    /// altitude relativa à largada em cada km
    var altitudeKm: [Double]?
    var fcKm: [Double?]?
    var leitura: Leitura?
    var preparo: Preparo?

    static func == (a: Maratona, b: Maratona) -> Bool { a.id == b.id }
    func hash(into h: inout Hasher) { h.combine(id) }

    static let distanciaKm = 42.195

    var ano: String { String(data.prefix(4)) }
    var local: String { cidade ?? nome }
    /// "Portland 2024"
    var rotulo: String { "\(local) \(ano)" }
    /// "POA" não diz nada: usa até 9 letras da cidade + ano curto
    var rotuloCurto: String { "\(local.count > 10 ? String(local.prefix(9)) + "…" : local) ’\(data.dropFirst(2).prefix(2))" }

    var bandeira: String {
        guard let c = codigoPais, c.count == 2 else { return "🏁" }
        return c.uppercased().unicodeScalars.compactMap { Unicode.Scalar(127_397 + $0.value) }.map { String($0) }.joined()
    }

    var dataReal: Date { Self.leitor.date(from: data) ?? Date(timeIntervalSince1970: 0) }
    var dataLonga: String {
        dataReal.formatted(Date.FormatStyle(date: .long, time: .omitted, locale: Locale(identifier: "pt_BR")))
    }

    private static let leitor: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()
    static func dia(_ s: String) -> Date? { leitor.date(from: s) }

    /// parciais por km confiáveis (Chicago não: o GPS se perdeu entre os prédios)
    var temParciais: Bool { tempoKm != nil && !gpsImpreciso }

    /// pace (seg) de cada um dos 42 km
    var pacesKm: [Double]? {
        guard temParciais, let t = tempoKm else { return nil }
        return t.indices.map { $0 == 0 ? t[0] : t[$0] - t[$0 - 1] }
    }

    /// Tempo acumulado numa distância; sem parciais confiáveis, supõe ritmo constante.
    func tempo(noKm km: Double) -> Double {
        guard temParciais, let t = tempoKm, t.count == 42 else { return tempoSeg * km / Self.distanciaKm }
        if km >= Self.distanciaKm { return tempoSeg }
        if km >= 42 { return t[41] + (tempoSeg - t[41]) * (km - 42) / 0.195 }
        let i = Int(km)
        let antes = i == 0 ? 0 : t[i - 1]
        return antes + (t[i] - antes) * (km - Double(i))
    }

    /// Onde o corredor estava (km) depois de `seg` segundos de prova.
    func km(noTempo seg: Double) -> Double {
        if seg >= tempoSeg { return Self.distanciaKm }
        guard temParciais, let t = tempoKm, t.count == 42 else { return seg / tempoSeg * Self.distanciaKm }
        guard let i = t.firstIndex(where: { $0 > seg }) else {
            return 42 + 0.195 * (seg - t[41]) / max(tempoSeg - t[41], 1)
        }
        let antes = i == 0 ? 0 : t[i - 1]
        return Double(i) + (seg - antes) / max(t[i] - antes, 1)
    }
}

/// Rota de alta resolução (POST /api/rota-completa).
struct RotaMaratona: Codable {
    var polyline: String
    var alt: [Double]?
    var vel: [Double]?
    var fc: [Double]?
}

struct FotoMaratona: Codable, Identifiable {
    var url: String
    var legenda: String?
    var id: String { url }
}

extension Servidor {
    static func buscarMaratonas() async throws -> Data {
        try await executar(try requisicao("api/maratonas"))
    }

    static func buscarRotaMaratona(stravaId: Int) async throws -> RotaMaratona? {
        struct Resposta: Decodable { var rota: RotaMaratona? }
        var req = try requisicao("api/rota-completa", metodo: "POST")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: ["stravaId": stravaId])
        return try JSONDecoder().decode(Resposta.self, from: try await executar(req)).rota
    }

    static func buscarFotosMaratona(stravaId: Int) async throws -> [FotoMaratona] {
        struct Resposta: Decodable { var fotos: [FotoMaratona] }
        var req = try requisicao("api/fotos-corrida")
        req.url = req.url.flatMap { URL(string: $0.absoluteString + "?stravaId=\(stravaId)") }
        return try JSONDecoder().decode(Resposta.self, from: try await executar(req)).fotos
    }
}

// MARK: - Store

@Observable
@MainActor
final class MaratonasStore {
    private(set) var painel: PainelMaratonas?
    private(set) var carregando = false
    var erro: String?

    private(set) var todas: [Maratona] = []
    /// já decodificadas: a rota e o ponto de cada prova são usados a cada quadro do mapa
    private(set) var rotas: [String: [CLLocationCoordinate2D]] = [:]
    private(set) var pontos: [String: CLLocationCoordinate2D] = [:]

    private static let arquivo = URL.cachesDirectory.appending(path: "maratonas.json")

    func carregar() async {
        // abre na hora com o que já foi baixado, e atualiza por trás
        if painel == nil, let d = try? Data(contentsOf: Self.arquivo), let p = try? JSONDecoder().decode(PainelMaratonas.self, from: d) {
            aplicar(p)
        }
        carregando = true
        defer { carregando = false }
        do {
            let d = try await Servidor.buscarMaratonas()
            aplicar(try JSONDecoder().decode(PainelMaratonas.self, from: d))
            try? d.write(to: Self.arquivo)
            erro = nil
        } catch is CancellationError {
        } catch {
            if !Task.isCancelled { erro = error.localizedDescription }
        }
    }

    /// Uma maratona dos Resultados que também está na aba Maratonas divide as mesmas fotos.
    static func chaveFotos(de t: ResumoCorrida) async -> String {
        guard t.ehCorrida, t.distanciaM > 40_000 else { return t.id }
        func achar(_ d: Data?) -> Maratona? {
            guard let d, let p = try? JSONDecoder().decode(PainelMaratonas.self, from: d) else { return nil }
            let f = DateFormatter()
            f.locale = Locale(identifier: "en_US_POSIX")
            f.calendar = Calendar(identifier: .gregorian)
            f.dateFormat = "yyyy-MM-dd"
            // a data da prova é a do local: aceita um dia de diferença de fuso
            let dias = [-86_400.0, 0, 86_400].map { f.string(from: t.data.addingTimeInterval($0)) }
            return p.maratonas.first { dias.contains($0.data) }
        }
        if let m = achar(try? Data(contentsOf: arquivo)) { return m.chaveFotos }
        guard Servidor.configurado, let d = try? await Servidor.buscarMaratonas() else { return t.id }
        try? d.write(to: arquivo)
        return achar(d)?.chaveFotos ?? t.id
    }

    private func aplicar(_ p: PainelMaratonas) {
        var r: [String: [CLLocationCoordinate2D]] = [:]
        var pts: [String: CLLocationCoordinate2D] = [:]
        for m in p.maratonas {
            let c = PolylineDecoder.decodificar(m.polyline ?? "")
            if c.count > 1 { r[m.id] = c }
            if let la = m.lat, let ln = m.lng { pts[m.id] = CLLocationCoordinate2D(latitude: la, longitude: ln) } else if let ini = c.first { pts[m.id] = ini }
        }
        rotas = r
        pontos = pts
        todas = p.maratonas.sorted { $0.data < $1.data }
        painel = p
    }

    var melhor: Maratona? { todas.min { $0.tempoSeg < $1.tempoSeg } }
    var paises: [(codigo: String, nome: String, bandeira: String, provas: [Maratona])] {
        Dictionary(grouping: todas.filter { $0.codigoPais != nil }, by: { $0.codigoPais! })
            .map { (codigo: $0.key, nome: $0.value[0].pais ?? $0.key, bandeira: $0.value[0].bandeira, provas: $0.value) }
            .sorted { ($0.provas.count, $1.nome) > ($1.provas.count, $0.nome) }
    }
    /// provas que eram o recorde pessoal no dia em que foram corridas
    var recordes: Set<String> {
        var melhor = Double.infinity
        var ids: Set<String> = []
        for m in todas where m.tempoSeg < melhor { melhor = m.tempoSeg; ids.insert(m.id) }
        return ids
    }
}

/// "+3:20" / "−1:05" (tempo a mais ou a menos)
func formatarDiferenca(_ seg: Double) -> String {
    (seg >= 0 ? "+" : "−") + formatarDuracao(abs(seg))
}

func formatarHorasMin(_ seg: Double) -> String {
    let t = Int((seg / 60).rounded())
    return "\(t / 60):" + String(format: "%02d", t % 60)
}

/// escuro das provas, o mesmo do cartão de prova dos Resultados
let escuroProva = Color(red: 0.10, green: 0.11, blue: 0.14)
