import SwiftUI

/// Tema claro, inspirado nos mockups (laranja = esforço, verde-água = fácil, lima = ação principal).
enum Tema {
    static let fundo = Color(red: 0.965, green: 0.965, blue: 0.945)
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

/// Fundo do app: o off-white de sempre com um respingo de cor no topo (lima e aqua), bem suave.
struct FundoColorido: View {
    var body: some View {
        ZStack(alignment: .top) {
            Tema.fundo
            LinearGradient(
                colors: [Tema.lima.opacity(0.38), Tema.aqua.opacity(0.14), Tema.fundo.opacity(0)],
                startPoint: .topLeading,
                endPoint: .bottom
            )
            .frame(height: 380)
            Circle()
                .fill(Tema.azul.opacity(0.10))
                .frame(width: 260, height: 260)
                .blur(radius: 50)
                .offset(x: 140, y: -60)
        }
        .ignoresSafeArea()
    }
}
