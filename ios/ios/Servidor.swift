import Foundation
import Security

/// Endereço do site e token de acesso. O token fica no Keychain; o endereço, nos Ajustes do app.
enum Servidor {
    static let enderecoPadrao = "https://financeiro.marcioscar.com.br"
    private static let chaveEndereco = "enderecoServidor"
    private static let contaToken = "treino-api-token"
    private static let servico = "br.com.marcioscar.treinowatch"

    static var endereco: String {
        get { UserDefaults.standard.string(forKey: chaveEndereco) ?? enderecoPadrao }
        set { UserDefaults.standard.set(newValue.trimmingCharacters(in: .whitespacesAndNewlines), forKey: chaveEndereco) }
    }

    static var token: String? {
        get {
            let q: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: servico,
                kSecAttrAccount as String: contaToken,
                kSecReturnData as String: true,
                kSecMatchLimit as String: kSecMatchLimitOne,
            ]
            var out: CFTypeRef?
            guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
            return String(data: d, encoding: .utf8)
        }
        set {
            let base: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: servico,
                kSecAttrAccount as String: contaToken,
            ]
            SecItemDelete(base as CFDictionary)
            guard let novo = newValue?.trimmingCharacters(in: .whitespacesAndNewlines), !novo.isEmpty else { return }
            var add = base
            add[kSecValueData as String] = Data(novo.utf8)
            SecItemAdd(add as CFDictionary, nil)
        }
    }

    static var configurado: Bool { !(token ?? "").isEmpty }

    enum Erro: LocalizedError {
        case semToken, urlInvalida, token, servidor(Int), rede(String)

        var errorDescription: String? {
            switch self {
            case .semToken: "Configure o token nos Ajustes (engrenagem)."
            case .urlInvalida: "Endereço do site inválido."
            case .token: "Token recusado pelo site. Confira nos Ajustes."
            case .servidor(let c) where c == 503: "O site ainda não tem o TREINO_API_TOKEN configurado."
            case .servidor(let c): "O site respondeu com erro \(c)."
            case .rede(let m): "Sem conexão com o site: \(m)"
            }
        }
    }

    static func buscarSemana() async throws -> RespostaSemana {
        guard let token, !token.isEmpty else { throw Erro.semToken }
        guard let url = URL(string: endereco)?.appendingPathComponent("api/treino-semana"), url.scheme?.hasPrefix("http") == true else {
            throw Erro.urlInvalida
        }
        var req = URLRequest(url: url, timeoutInterval: 20)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        do {
            let (dados, resp) = try await URLSession.shared.data(for: req)
            let codigo = (resp as? HTTPURLResponse)?.statusCode ?? 0
            if codigo == 401 { throw Erro.token }
            guard codigo == 200 else { throw Erro.servidor(codigo) }
            return try JSONDecoder().decode(RespostaSemana.self, from: dados)
        } catch let e as Erro {
            throw e
        } catch let e as DecodingError {
            throw Erro.rede("resposta inesperada (\(e.localizedDescription))")
        } catch {
            throw Erro.rede(error.localizedDescription)
        }
    }
}
