/**
 * Original stages (decision C-002), designed with `scripts/design-stages.ts` and curated by hand.
 * Base tiles only (2–4 teams). More stages, Peloton variants and tours come with later milestones.
 */
import type { StageDefinition } from '../schema';

const stage = (id: string, name: string, tiles: string): StageDefinition => ({
  id,
  name,
  source: 'original',
  playerVariant: '2-4',
  type: 'normal',
  tiles: tiles.split(' '),
});

export const ORIGINAL_STAGES: readonly StageDefinition[] = [
  stage(
    'harbour-loop',
    'Harbour Loop',
    'a_s d_w r_w l_s c_s t_s b_w j_s f_s n_w g_w e_w h_s q_w s_s i_s k_w p_w m_s o_s u_s',
  ),
  stage(
    'orchard-ring',
    'Orchard Ring',
    'a_w q_w p_w r_w c_s d_s i_s h_s s_s m_w k_s o_w l_w f_s t_w b_s e_w g_w j_w n_s u_w',
  ),
  stage(
    'three-hills',
    'Three Hills',
    'a_s i_w c_w d_w b_w s_w j_w m_w o_w e_w p_s g_s k_w f_w t_w h_w l_s n_w q_w r_s u_s',
  ),
];
