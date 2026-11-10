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
  type: StageDefinition['type'] = 'normal',
): StageDefinition => ({
  id,
  name,
  source: 'original',
  playerVariant,
  type,
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
  // Grand Tour stages: new tiles (sharp corners z, roundabouts x/y), time trials and extended
  // stages, all with the wide finish (v).
  stage(
    'prologue',
    'Prologue',
    'a_w h_w j_s b_w e_w o_w r_w c_s d_s i_w q_w m_w f_w g_s l_s t_w p_s s_w n_s k_s v_w',
    'any',
    'teamTimeTrial',
  ),
  stage(
    'hairpin-hollow',
    'Hairpin Hollow',
    'a_s i_w z_s r_s l_w e_s m_w k_w j_w g_w f_w t_w h_w s_s p_w y_s q_w d_w o_w b_w v_s',
  ),
  stage(
    'roundabout-run',
    'Roundabout Run',
    'a_w t_s i_s z_w h_s p_w g_w b_w j_s d_w c_w k_s q_s o_w f_w y_s r_w l_w e_s s_w v_w',
  ),
  stage(
    'ringroad-rally',
    'Ringroad Rally',
    'a_w l_w j_s q_s c_s h_w k_w b_w g_w y_s o_w t_s n_w r_w z_w i_s s_s d_w p_w e_s v_s',
  ),
  stage(
    'switchback',
    'Switchback',
    'a_w e_w s_s g_s k_w i_w b_w q_s o_w n_w f_w l_w r_w p_w z_w h_s m_w t_w y_w j_w v_s',
  ),
  stage(
    'granite-gate',
    'Granite Gate',
    'a_w j_w p_s h_s e_w 5_w t_w i_w l_w s_w 4_w r_w k_s z_w o_w f_s q_w x_s g_s 7_s v_w',
  ),
  stage(
    'coastline-circuit',
    'Coastline Circuit',
    'a_w o_s 5_s 3_s z_s h_w p_s x_s m_w d_w q_w t_s i_s s_w 4_w r_w k_s j_w e_w g_w v_w',
  ),
  stage(
    'clockwork',
    'Clockwork',
    'a_w j_s t_s p_s 5_w l_w o_w s_w n_w r_w m_s q_s k_s 7_w c_w e_w h_s g_w f_w i_w v_w',
    'any',
    'individualTimeTrial',
  ),
  stage(
    'final-clock',
    'Final Clock',
    'a_w s_s t_s k_s g_s o_s e_s i_s d_w b_w 4_w n_w p_w f_s h_w c_s r_s 6_w q_w j_s v_s',
    'any',
    'individualTimeTrial',
  ),
  stage(
    'long-road',
    'The Long Road',
    'a_w i_w 3_w e_w b_s t_w 7_w n_s o_w 6_s j_w 4_w r_w f_s h_w m_w l_w p_w s_w c_w k_s d_s g_w q_w v_w',
    '2-4',
    'extended',
  ),
  stage(
    'endless-orchard',
    'Endless Orchard',
    'a_w o_w c_w d_w k_w n_w p_w 3_w i_s s_s l_s e_w 4_w m_w r_s 6_w g_s f_w q_w t_s h_s 7_w j_w b_s v_w',
    '2-4',
    'extended',
  ),
  stage(
    'mountain-marathon',
    'Mountain Marathon',
    'a_s n_w 6_s b_s d_w s_s f_s p_s q_s k_s 8_s r_w y_w h_s z_w t_s o_w 4_w e_w i_s 5_s j_s g_w m_w v_w',
    '2-4',
    'extended',
  ),
  stage(
    'bridge-of-wheels',
    'Bridge of Wheels',
    '1_s p_w z_w o_w 9_s k_w q_s b_w e_w h_s j_w 4_w 3_w x_s r_w i_w g_s t_w s_s 5_w d_w v_w',
    '5-6',
  ),
  stage(
    'copperleaf-classic',
    'Copperleaf Classic',
    '1_w 4_w s_s l_w p_s k_w 9_s j_w x_s e_w 8_s 6_w z_s g_w i_s t_w r_s 3_w o_w h_s q_w v_w',
    '5-6',
  ),
];
