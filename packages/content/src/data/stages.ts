/**
 * Original stages (decision C-002), designed with `scripts/design-stages.ts` / `generateStage` and
 * curated by hand. The Peloton stages put the breakaway tile (#2) after the start, so they work
 * with or without the breakaway variant; the five-to-six-team ones use the wide start (#1), the
 * bonus tile (#9) and both supply zones (P-DES-1).
 */
import type { StageDefinition } from '../schema';

const stage = (
  id: string,
  name: string,
  tiles: string,
  playerVariant: StageDefinition['playerVariant'] = '2-4',
): StageDefinition => ({
  id,
  name,
  source: 'original',
  playerVariant,
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
  stage(
    'cobble-coast',
    'Cobble Coast',
    'a_w 2_s p_s o_w l_w m_w i_s k_w h_w r_s b_s s_w e_w j_w q_w d_w g_w t_w 7_w c_s f_w u_w',
  ),
  stage(
    'feed-station',
    'Feed Station',
    'a_s 2_s 3_w q_w j_s b_w r_w l_w 8_s h_s o_w i_s e_w n_w k_w g_w c_w t_w s_w d_w p_w u_s',
  ),
  stage(
    'paving-stones',
    'Paving Stones',
    '1_w 2_w e_w q_w b_w g_w p_w h_s 3_w t_w f_w o_s 5_w c_w k_s r_w d_w 4_w s_w 9_s j_s i_w u_w',
    '5-6',
  ),
  stage(
    'grand-peloton',
    'Grand Peloton',
    '1_s 2_w m_w t_w k_s q_w d_w o_w b_w s_s j_w 9_s e_w p_w 7_w r_w g_s 6_s h_w 3_w 4_w i_w u_w',
    '5-6',
  ),
];
