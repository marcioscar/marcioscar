# TreinoWatch — primeiro treino fixo no Apple Watch

App de iPhone mínimo (SwiftUI + WorkoutKit) que agenda um treino de teste no Apple Watch.
Não precisa de app no relógio: o WorkoutKit sincroniza pelo iPhone com o app Treino do relógio.

## Criar o projeto no Xcode (uma vez)

1. Xcode → File → New → Project → **iOS → App**.
   - Product Name: `TreinoWatch`
   - Interface: SwiftUI · Language: Swift
   - Team: seu Apple ID pessoal ("Personal Team")
   - Bundle Identifier: algo único, ex.: `br.com.marcioscar.treinowatch`
2. Apague o `ContentView.swift` e o `TreinoWatchApp.swift` que o Xcode criou.
3. Arraste os 3 arquivos `.swift` desta pasta para dentro do projeto (marque "Copy items if needed").
4. Target `TreinoWatch` → **Minimum Deployments**: iOS 17.0 ou superior.
5. Target → **Signing & Capabilities** → **+ Capability** → **HealthKit**
   (se o prompt de permissão não aparecer depois, é isso que falta).
6. Conecte o iPhone por cabo (ou Wi-Fi), escolha-o como destino e rode (⌘R).
   Na primeira vez: iPhone → Ajustes → Geral → VPN e gerenciamento de dispositivo → confiar no seu perfil.
   Modo de desenvolvedor ligado em Ajustes → Privacidade e segurança.

## Testar

1. No app, toque em **Ver prévia** (mostra o treino) e depois **Enviar para o relógio**.
2. Aceite a permissão.
3. No Apple Watch: app **Treino** → role até **Treinos agendados** (ou o aviso do iPhone).

Conta gratuita: o app expira em 7 dias; é só rodar de novo pelo Xcode para renovar.

## Ajustes prováveis

Foi escrito sem poder compilar neste Mac (sem Xcode instalado). Se o Xcode reclamar:
- `schedule(_:at:)`: confira se o segundo parâmetro é `DateComponents` e se precisa de `try`.
- `IntervalStep(.work, goal:)`: se não existir, use `IntervalStep(.work, step: WorkoutStep(goal: ...))`.
- `CustomWorkout(... displayName:)`: a ordem/rótulos dos parâmetros pode variar por versão do iOS.
