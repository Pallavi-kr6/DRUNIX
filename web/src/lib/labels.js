export const NAME = { OPERATOR: 'Platform Operator', FINANCIER_A: 'Financier A', FINANCIER_B: 'Financier B', FINANCIER_C: 'Financier C (test identity)', FINANCIER_D: 'Financier D (test identity)', INSURER: 'Insurer / Guarantor', AUDITOR: 'Auditor' };
export const HOLDER_COLOR = { FINANCIER_A: '#2b6cb0', FINANCIER_B: '#0f8f7e', FINANCIER_C: '#8a5cc2', FINANCIER_D: '#c26b1f' };
export const FINANCIERS = ['FINANCIER_A', 'FINANCIER_B', 'FINANCIER_C', 'FINANCIER_D'];
export const roleOf = (id) => (id?.startsWith('FINANCIER') ? 'FINANCIER' : id);
export const MOVABLE = ['DISCOUNTED', 'PARTIALLY_TRANSFERRED'];
