import SwiftUI

/// Tema claro, inspirado nos mockups (laranja = esforço, verde-água = fácil, lima = ação principal).
enum Tema {
    /// cinza neutro das listas do iOS: os cartões brancos se destacam
    static let fundo = Color(red: 0.945, green: 0.947, blue: 0.960)
    static let cartao = Color.white
    static let linha = Color.black.opacity(0.07)
    static let texto = Color(red: 0.08, green: 0.09, blue: 0.11)
    static let textoSuave = Color(red: 0.42, green: 0.44, blue: 0.48)
    static let lima = Color(red: 0.84, green: 0.95, blue: 0.30)
    static let limaTexto = Color(red: 0.08, green: 0.09, blue: 0.11)
    static let laranja = Color(red: 0.97, green: 0.52, blue: 0.20)
    static let aqua = Color(red: 0.25, green: 0.74, blue: 0.62)
    static let cinzaPausa = Color(red: 0.62, green: 0.65, blue: 0.70)
    static let azul = Color(red: 0.30, green: 0.50, blue: 0.95)
    static let roxo = Color(red: 0.62, green: 0.40, blue: 0.88)
    static let vermelho = Color(red: 0.88, green: 0.28, blue: 0.30)
    /// prova: dourado, para se destacar dos treinos
    static let ouro = Color(red: 0.92, green: 0.66, blue: 0.10)
}

extension TipoSessao {
    var cor: Color {
        switch self {
        case .leve: Tema.aqua
        case .limiar: Tema.azul
        case .tiros: Tema.laranja
        case .longao: Tema.roxo
        case .prova: Tema.vermelho
        case .musculacao: Color(red: 0.36, green: 0.38, blue: 0.80)
        }
    }
}

extension PapelEtapa {
    var cor: Color {
        switch self {
        case .aquecimento, .desaquecimento: Tema.aqua
        case .trabalho: Tema.laranja
        case .recuperacao: Tema.cinzaPausa
        }
    }
}

/// Botão principal (lima, texto escuro, cantos bem redondos).
struct BotaoPrincipal: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(Tema.limaTexto)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Tema.lima.opacity(configuration.isPressed ? 0.7 : 1), in: RoundedRectangle(cornerRadius: 18))
    }
}

struct BotaoSecundario: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(Tema.texto)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                RoundedRectangle(cornerRadius: 18)
                    .stroke(Tema.texto.opacity(0.25), lineWidth: 1.5)
                    .background(Color.white.opacity(configuration.isPressed ? 0.5 : 0), in: RoundedRectangle(cornerRadius: 18))
            )
    }
}

extension View {
    /// Cartão de treino: branco, com a cor do exercício numa faixa na lateral (o resto fica limpo).
    func cartaoTreino(cor: Color, raio: CGFloat = 16) -> some View {
        self.background(Tema.cartao, in: RoundedRectangle(cornerRadius: raio))
            .overlay(alignment: .leading) {
                Capsule().fill(cor).frame(width: 5).padding(.vertical, 12).padding(.leading, 8)
            }
            .overlay(RoundedRectangle(cornerRadius: raio).stroke(Tema.linha, lineWidth: 1))
    }

    func cartao(raio: CGFloat = 20) -> some View {
        self.background(Tema.cartao, in: RoundedRectangle(cornerRadius: raio))
            .overlay(RoundedRectangle(cornerRadius: raio).stroke(Tema.linha, lineWidth: 1))
    }
}

struct Selo: View {
    let texto: String
    let cor: Color
    var body: some View {
        Text(texto.uppercased())
            .font(.caption.weight(.heavy))
            .tracking(0.5)
            .foregroundStyle(.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(cor, in: Capsule())
    }
}

/// Fundo do app: cinza neutro e chapado.
struct FundoColorido: View {
    var body: some View {
        // cinza neutro e chapado (o de listas do iOS): os cartões brancos e coloridos se destacam sem competir com o fundo
        Tema.fundo
        .ignoresSafeArea()
    }
}

/// Ícone do exercício num quadradinho tingido com a sua cor.
struct IconeTreino: View {
    let simbolo: String
    let cor: Color
    var tamanho: CGFloat = 40

    var body: some View {
        Image(systemName: simbolo)
            .font(.system(size: tamanho * 0.42, weight: .semibold))
            .foregroundStyle(cor)
            .frame(width: tamanho, height: tamanho)
            .background(cor.opacity(0.16), in: RoundedRectangle(cornerRadius: tamanho * 0.28))
    }
}
