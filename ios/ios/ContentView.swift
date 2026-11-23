import SwiftUI
import WorkoutKit

struct ContentView: View {
    @State private var mensagem = "Toque em “Enviar para o relógio” para agendar o treino de teste para hoje."
    @State private var mostrarPrevia = false
    private let plano = TreinoFixo.plano()

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "figure.run")
                .font(.system(size: 56))
                .foregroundStyle(.tint)

            Text("Treino de teste")
                .font(.title2.bold())
            Text("Aquecimento 5 min (Z1–Z2) · 4 × 400 m em Z5 (4:40–4:15) com 90 s de trote em Z1 · desaquecimento 5 min")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Button("Ver prévia") { mostrarPrevia = true }
                .buttonStyle(.bordered)

            Button("Enviar para o relógio") {
                Task { await enviar() }
            }
            .buttonStyle(.borderedProminent)

            Text(mensagem)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(24)
        .workoutPreview(plano, isPresented: $mostrarPrevia)
    }

    private func enviar() async {
        let estado = await WorkoutScheduler.shared.requestAuthorization()
        guard estado == .authorized else {
            mensagem = "Sem permissão para agendar treinos. Libere em Ajustes > Saúde > Acesso a dados e dispositivos."
            return
        }

        // cada toque cria um plano novo (id novo): sem limpar, o relógio acumula versões antigas
        // do treino, inclusive a sem alertas de pace
        await WorkoutScheduler.shared.removeAllWorkouts()

        // agenda para daqui a 1 minuto, no dia de hoje
        let quando = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute],
            from: Date().addingTimeInterval(60)
        )
        await WorkoutScheduler.shared.schedule(plano, at: quando)
        mensagem = "Agendado para hoje (treinos antigos removidos). Abra o app Treino no Apple Watch: ele aparece em “Treinos agendados”."
    }
}
