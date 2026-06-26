export type Phase = 'Geral' | 'Fundamental' | 'Específica' | 'Taper'

export interface Session {
  day: 'Seg' | 'Ter' | 'Qua' | 'Qui' | 'Sex' | 'Sáb' | 'Dom'
  type: string
  paceOffset: string
  detail: string
}

export interface Week {
  number: number
  phase: Phase
  title: string
  volumeFraction: number
  isKeyWeek: boolean
  isWarning?: boolean
  sessions: Session[]
  tip: string
}

export interface TrainingPlan {
  id: string
  name: string
  distance: '21.1km' | '42.2km'
  totalWeeks: number
  defaultTargetPace: string
  defaultWeeklyKm: number
  lastLongRunWeeksOut: number
  lastLongRunWeek?: number
  weeks: Week[]
}

export const halfMarathonPlan: TrainingPlan = {
  id: 'half-marathon-canova',
  name: 'Meia Maratona – Canova',
  distance: '21.1km',
  totalWeeks: 12,
  defaultTargetPace: '5:00',
  defaultWeeklyKm: 60,
  lastLongRunWeeksOut: 3,
  weeks: [
    {
      number: 1,
      phase: 'Geral',
      title: 'Construção aeróbica base',
      volumeFraction: 0.65,
      isKeyWeek: false,
      sessions: [
        { day: 'Seg', type: 'Fácil', paceOffset: '+60s', detail: '45–50 min contínuo, ritmo de conversa' },
        { day: 'Ter', type: 'Moderado + strides', paceOffset: '+40s', detail: '40 min + 6×20s em aceleração' },
        { day: 'Qui', type: 'Fácil longo', paceOffset: '+60s', detail: '60 min, cadência estável' },
        { day: 'Sex', type: 'Fácil', paceOffset: '+60s', detail: '30–40 min regenerativo' },
        { day: 'Sáb', type: 'Longão base', paceOffset: '+45s', detail: '14–16 km, ritmo aeróbico' },
      ],
      tip: 'Semana de adaptação. Não force ritmo — a base aeróbica é o alicerce de tudo.',
    },
    {
      number: 2,
      phase: 'Geral',
      title: 'Aumento progressivo de volume',
      volumeFraction: 0.70,
      isKeyWeek: false,
      sessions: [
        { day: 'Seg', type: 'Fácil', paceOffset: '+60s', detail: '45 min contínuo' },
        { day: 'Ter', type: 'Contínuo moderado', paceOffset: '+40s', detail: '50 min, sem oscilação de ritmo' },
        { day: 'Qui', type: 'Tempo curto', paceOffset: '+15s', detail: '3×10 min com 2 min de trote entre' },
        { day: 'Sex', type: 'Recuperação', paceOffset: '+75s', detail: '30 min muito leve' },
        { day: 'Sáb', type: 'Longão', paceOffset: '+45s', detail: '16–18 km aeróbico' },
      ],
      tip: 'Introduz o primeiro tempo curto. Mantenha o esforço em 88–92% do pace alvo.',
    },
    {
      number: 3,
      phase: 'Geral',
      title: 'Eficiência de ritmo',
      volumeFraction: 0.75,
      isKeyWeek: false,
      sessions: [
        { day: 'Seg', type: 'Fácil', paceOffset: '+60s', detail: '45 min' },
        { day: 'Ter', type: 'Intervalado aeróbico', paceOffset: '+20s', detail: '6×1.000 m, rec. 90s trote' },
        { day: 'Qui', type: 'Corrida de colinas', paceOffset: 'esforço', detail: '40 min com 6–8 subidas de 100–150 m' },
        { day: 'Sex', type: 'Fácil', paceOffset: '+60s', detail: '35 min' },
        { day: 'Sáb', type: 'Longão', paceOffset: '+40s', detail: '18–20 km' },
      ],
      tip: 'O treino de colinas desenvolve força específica sem acumular lactato — essencial na fase geral.',
    },
    {
      number: 4,
      phase: 'Fundamental',
      title: 'Resistência no limiar',
      volumeFraction: 0.80,
      isKeyWeek: false,
      sessions: [
        { day: 'Seg', type: 'Fácil', paceOffset: '+60s', detail: '40 min' },
        { day: 'Ter', type: 'Tempo longo', paceOffset: '+5s a +10s', detail: '3×15 min, rec. 2 min trote' },
        { day: 'Qui', type: 'Contínuo moderado', paceOffset: '+30s', detail: '55 min, constante' },
        { day: 'Sex', type: 'Fácil + strides', paceOffset: '+60s', detail: '35 min + 6×20s' },
        { day: 'Sáb', type: 'Longão com progressão', paceOffset: '+45s → pace alvo', detail: '20 km: últimos 5 km em pace alvo' },
      ],
      tip: 'Fase fundamental começa. O longão agora tem um trecho em pace de prova.',
    },
    {
      number: 5,
      phase: 'Fundamental',
      title: 'Volume de qualidade',
      volumeFraction: 0.85,
      isKeyWeek: false,
      sessions: [
        { day: 'Seg', type: 'Fácil', paceOffset: '+60s', detail: '40 min' },
        { day: 'Ter', type: 'Intervalado', paceOffset: '-5s a 0s', detail: '5×2.000 m, rec. 2 min' },
        { day: 'Qui', type: 'Corrida contínua', paceOffset: '+20s', detail: '60 min, esforço controlado' },
        { day: 'Sex', type: 'Recuperação', paceOffset: '+75s', detail: '30 min muito leve' },
        { day: 'Sáb', type: 'Longão qualidade', paceOffset: '+35s → +10s', detail: '22 km: últimos 8 km próximos ao pace alvo' },
      ],
      tip: 'Intervalo principal: 5×2.000 m constrói a resistência ao lactato necessária para sustentar o pace de meia.',
    },
    {
      number: 6,
      phase: 'Fundamental',
      title: 'Pico de volume',
      volumeFraction: 0.90,
      isKeyWeek: true,
      sessions: [
        { day: 'Seg', type: 'Fácil', paceOffset: '+60s', detail: '40 min' },
        { day: 'Ter', type: 'Tempo', paceOffset: '+5s', detail: '2×20 min, rec. 3 min trote' },
        { day: 'Qui', type: 'Aeróbico moderado', paceOffset: '+30s', detail: '55 min' },
        { day: 'Sex', type: 'Fácil', paceOffset: '+60s', detail: '35 min + strides' },
        { day: 'Sáb', type: 'Longão longo', paceOffset: '+40s → pace alvo', detail: '24 km: últimos 10 km em pace alvo' },
      ],
      tip: 'Semana mais pesada da fase fundamental. Longão com 10 km em pace de prova é o treino mais importante do ciclo.',
    },
    {
      number: 7,
      phase: 'Fundamental',
      title: 'Consolidação',
      volumeFraction: 0.80,
      isKeyWeek: false,
      sessions: [
        { day: 'Seg', type: 'Recuperação ativa', paceOffset: '+75s', detail: '35 min muito leve' },
        { day: 'Ter', type: 'Intervalado', paceOffset: '-5s', detail: '4×1.600 m, rec. 90s' },
        { day: 'Qui', type: 'Contínuo moderado', paceOffset: '+25s', detail: '50 min' },
        { day: 'Sex', type: 'Fácil', paceOffset: '+60s', detail: '30 min' },
        { day: 'Sáb', type: 'Longão moderado', paceOffset: '+40s', detail: '20 km, ritmo aeróbico uniforme' },
      ],
      tip: 'Semana de consolidação pós-pico. Volume menor, qualidade mantida — permite absorção das adaptações.',
    },
    {
      number: 8,
      phase: 'Específica',
      title: 'Resistência específica',
      volumeFraction: 0.85,
      isKeyWeek: false,
      sessions: [
        { day: 'Seg', type: 'Fácil', paceOffset: '+60s', detail: '40 min' },
        { day: 'Ter', type: 'Specific Extensive Endurance', paceOffset: 'pace alvo', detail: '4×3.000 m em pace exato, rec. 1.000 m trote' },
        { day: 'Qui', type: 'Moderado', paceOffset: '+30s', detail: '50 min' },
        { day: 'Sex', type: 'Fácil', paceOffset: '+60s', detail: '30 min' },
        { day: 'Sáb', type: 'Longão específico 1', paceOffset: '+20s → pace alvo', detail: '22 km: 12 km finais em pace alvo' },
      ],
      tip: 'Fase específica: os treinos agora simulam diretamente a prova. Os 3.000 m em pace exato são o coração dessa semana.',
    },
    {
      number: 9,
      phase: 'Específica',
      title: 'Afinamento de ritmo',
      volumeFraction: 0.85,
      isKeyWeek: true,
      sessions: [
        { day: 'Seg', type: 'Fácil', paceOffset: '+60s', detail: '40 min' },
        { day: 'Ter', type: 'Marathon Pace Rhythm', paceOffset: 'pace alvo', detail: '16 km contínuos em pace alvo' },
        { day: 'Qui', type: 'Moderado + strides', paceOffset: '+30s', detail: '45 min + 6×20s' },
        { day: 'Sex', type: 'Recuperação', paceOffset: '+75s', detail: '30 min' },
        { day: 'Sáb', type: 'Longão específico 2', paceOffset: 'pace alvo', detail: '20 km: 14 km em pace alvo' },
      ],
      tip: 'O treino de 16 km em pace alvo é o "teste de realidade" — se conseguir manter, está pronto para a prova.',
    },
    {
      number: 10,
      phase: 'Específica',
      title: 'Pico de especificidade',
      volumeFraction: 0.80,
      isKeyWeek: true,
      isWarning: true,
      sessions: [
        { day: 'Seg', type: 'Fácil', paceOffset: '+60s', detail: '35 min' },
        { day: 'Ter', type: 'Specific Endurance', paceOffset: 'pace alvo', detail: '3×4.000 m em pace alvo, rec. 1.000 m trote' },
        { day: 'Qui', type: 'Contínuo leve', paceOffset: '+45s', detail: '45 min' },
        { day: 'Sex', type: 'Fácil', paceOffset: '+60s', detail: '30 min' },
        { day: 'Sáb', type: 'Longão específico 3 — ÚLTIMO LONGÃO LONGO', paceOffset: '+15s → pace alvo', detail: '18 km: 12–14 km em pace alvo. Último longão longo — não mover para mais perto da prova.' },
      ],
      tip: '⚠️ ÚLTIMO LONGÃO LONGO — deve ocorrer no mínimo 3 semanas antes da prova.',
    },
    {
      number: 11,
      phase: 'Taper',
      title: 'Redução de volume (−25%)',
      volumeFraction: 0.55,
      isKeyWeek: false,
      sessions: [
        { day: 'Seg', type: 'Fácil', paceOffset: '+60s', detail: '35 min' },
        { day: 'Ter', type: 'Ativação de qualidade', paceOffset: 'pace alvo', detail: '8 km com 4 km em pace alvo' },
        { day: 'Qui', type: 'Fácil', paceOffset: '+60s', detail: '30 min' },
        { day: 'Sex', type: 'Strides', paceOffset: 'aceleração', detail: '20 min + 6×20s aceleração' },
        { day: 'Sáb', type: 'Corrida moderada', paceOffset: '+30s', detail: '12–14 km, sensação fácil' },
      ],
      tip: 'Taper começa: volume cai 25%, intensidade mantida. Um treino de qualidade curto por semana — não mais.',
    },
    {
      number: 12,
      phase: 'Taper',
      title: 'Semana da prova',
      volumeFraction: 0.30,
      isKeyWeek: false,
      sessions: [
        { day: 'Seg', type: 'Fácil', paceOffset: '+60s', detail: '25–30 min' },
        { day: 'Ter', type: 'Ativação', paceOffset: 'pace alvo', detail: '20 min + 3×1 km em pace alvo' },
        { day: 'Qui', type: 'Fácil', paceOffset: '+75s', detail: '20 min, pernas soltas' },
        { day: 'Sex', type: 'Descanso ou strides', paceOffset: '—', detail: 'Repouso ou 15 min + 4×15s strides' },
        { day: 'Dom', type: 'PROVA — 21,1 km', paceOffset: 'pace alvo', detail: 'Execute o plano. Saia 10–15s/km conservador nos primeiros 5 km.' },
      ],
      tip: 'Semana da prova: não faça nada novo. Confie no treino. Volume mínimo, energia máxima para o dia D.',
    },
  ],
}
