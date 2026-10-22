# Genera el Tablero de Indicadores CENTEC (Excel) con fórmulas vivas. Uso: python3 tablero_excel.py salida.xlsx
import sys, json
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.formatting.rule import FormulaRule
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment
from openpyxl.utils import get_column_letter as L

OUT = sys.argv[1] if len(sys.argv) > 1 else 'Tablero_Indicadores_CENTEC.xlsx'
IND = json.load(open('../../data/indicadores.json'))
NAVY, ORANGE = '1B2A6B', 'D9771E'
F = lambda **k: Font(name='Arial', size=10, **k)
H = Font(name='Arial', size=10, bold=True, color='FFFFFF')
HF = PatternFill('solid', fgColor=NAVY)
INP = PatternFill('solid', fgColor='FFF7CC')
thin = Side(style='thin', color='C8CED8'); B = Border(left=thin, right=thin, top=thin, bottom=thin)
wb = Workbook()

def head(ws, row, vals, widths=None):
    for i, v in enumerate(vals, 1):
        c = ws.cell(row, i, v); c.font = H; c.fill = HF; c.alignment = Alignment(wrap_text=True, vertical='center', horizontal='center'); c.border = B
    if widths:
        for i, w in enumerate(widths, 1): ws.column_dimensions[L(i)].width = w
    ws.row_dimensions[row].height = 54

# ---------- Instrucciones ----------
ws = wb.active; ws.title = 'Instrucciones'
ws.column_dimensions['A'].width = 110
txt = [
 ('TABLERO DE INDICADORES — PLANEACIÓN ACADÉMICA CENTEC (multi-año: 2027, 2028, …)', Font(name='Arial', size=14, bold=True, color=NAVY)),
 ('Complemento en Excel del aplicativo Sistema de Planeación CENTEC. Sirve para auditar en papel/Excel o cuando no haya conexión. Las fórmulas son las mismas del aplicativo (v%s).' % IND['version'], F()),
 ('', F()),
 ('CÓMO USARLO', F(bold=True, color=ORANGE)),
 ('1. Celdas con fondo amarillo = datos que usted digita. Celdas blancas = fórmulas (no las edite).', F()),
 ('2. Hoja «Registro»: una fila por docente y período, para cualquier año (columna Año). Las filas marcadas EJEMPLO muestran el formato: bórrelas antes de usar.', F()),
 ('3. Hoja «Parámetros»: pesos, umbrales y constantes. Si se cambian, suba la versión: el comparativo año a año dejará de ser comparable.', F()),
 ('4. Hoja «Tablero»: resumen por docente y por año. Hoja «Año vs año»: compara automáticamente cada indicador entre 2027 y 2031.', F()),
 ('5. Hoja «Lecciones»: decisiones del cierre anual (mantener / ajustar / eliminar / escalar) que alimentan la planeación del año siguiente.', F()),
 ('', F()),
 ('REGLAS QUE EVITAN EL SESGO', F(bold=True, color=ORANGE)),
] + [('• ' + r, F()) for r in IND['reglas_bloqueo']] + [
 ('• La normalización por observador (indulgencia/severidad) la calcula el aplicativo; en Excel digite el promedio Teach ya normalizado que reporta el aplicativo, o el promedio crudo si no lo usa.', F()),
 ('', F()),
 ('FUENTES: Teach (Banco Mundial) para observación; ganancia normalizada de Hake (1998) con contracción bayesiana; MET Project para pesos; EEF Toolkit y Dunlosky et al. (2013) para prácticas.', F(italic=True)),
]
for i, (t, f) in enumerate(txt, 1):
    c = ws.cell(i, 1, t); c.font = f; c.alignment = Alignment(wrap_text=True)

# ---------- Parámetros ----------
P = wb.create_sheet('Parámetros')
head(P, 1, ['Parámetro', 'Valor', 'Descripción / fuente'], [34, 12, 90])
params = [(c['codigo'] + ' ' + c['nombre'], c['peso'], c['formula']) for c in IND['componentes']] + [
 ('Umbral verde', 85, 'ICD ≥ 85'), ('Umbral amarillo', 70, 'ICD 70–84; menor que 70 = rojo'),
 ('Kappa mínimo', 0.60, 'Landis y Koch: ≥ 0,61 sustancial. Por debajo, la observación no cuenta'),
 ('k de contracción', 10, 'g ajustada = n/(n+k)·g + k/(n+k)·g media'),
 ('g media del colegio', 0.30, 'Actualizar cada año con el promedio institucional real (2027: supuesto inicial, Hake 1998)'),
 ('Mínimo de fuentes', 3, 'Sin 3 fuentes no se asigna color'),
 ('Versión de fórmulas', IND['version'], 'Cambia si cambia cualquier peso o fórmula')]
for i, (a, b, c) in enumerate(params, 2):
    P.cell(i, 1, a).font = F(); x = P.cell(i, 2, b); x.font = F(color='0000FF'); x.fill = INP; P.cell(i, 3, c).font = F()
    for j in (1, 2, 3): P.cell(i, j).border = B
    if i <= 11: x.number_format = '0%'
P.cell(12, 1, 'Suma de pesos (debe ser 100 %)').font = F(bold=True); P['B12'] = '=SUM(B2:B11)'; P['B12'].number_format = '0%'; P['B12'].font = F(bold=True)
# desplazar parámetros posteriores una fila: reescribir desde fila 13
for i, (a, b, c) in enumerate(params[10:], 13):
    P.cell(i, 1, a).font = F(); x = P.cell(i, 2, b); x.font = F(color='0000FF'); x.fill = INP; P.cell(i, 3, c).font = F()
    for j in (1, 2, 3): P.cell(i, j).border = B
P['B12'].fill = PatternFill(fill_type=None); P['A12'].fill = PatternFill(fill_type=None)
P['C12'] = 'Control'; P['C12'].font = F(italic=True)
W = {k: f"Parámetros!$B${i}" for i, k in enumerate(['C1','C2','C3','C4','C5','C6','C7','C8','C9','C10'], 2)}
VERDE, AMAR, KMIN, KC, GM, MINF = 'Parámetros!$B$13', 'Parámetros!$B$14', 'Parámetros!$B$15', 'Parámetros!$B$16', 'Parámetros!$B$17', 'Parámetros!$B$18'

# ---------- Registro ----------
R = wb.create_sheet('Registro')
cols = [
 ('Año', 7, 'in'), ('Período', 7, 'in'), ('Docente', 24, 'in'), ('Grado / área', 16, 'in'),
 ('Planeadores exigidos', 10, 'in'), ('Planeadores a tiempo', 10, 'in'), ('Semanas planeadas', 9, 'in'), ('Semanas con evidencia', 10, 'in'),
 ('DBA programados', 9, 'in'), ('DBA evidenciados', 10, 'in'), ('R1 total (0–24)', 9, 'in'), ('R2 promedio (0–3)', 9, 'in'),
 ('Teach promedio (1–5)', 9, 'in'), ('κ ponderado (vacío si 1 obs.)', 10, 'in'), ('Observadores distintos', 10, 'in'),
 ('g promedio estudiantes', 10, 'in'), ('n estudiantes (pre ≤ 90)', 10, 'in'), ('Ajustes PIAR comprometidos', 10, 'in'), ('Ajustes PIAR verificados', 10, 'in'),
 ('Fases transversales evidenciadas', 10, 'in'), ('Proyectos asignados', 9, 'in'), ('Encuesta promedio (1–5)', 9, 'in'), ('n encuesta', 8, 'in'),
 ('C1 Puntualidad', 9, 'f'), ('C2 Ejecución', 9, 'f'), ('C3 Cobertura DBA', 9, 'f'), ('C4 Planeador', 9, 'f'), ('C5 Cuadernos', 9, 'f'),
 ('C6 Observación', 9, 'f'), ('C7 Aprendizaje', 9, 'f'), ('C8 PIAR', 9, 'f'), ('C9 Transversal', 9, 'f'), ('C10 Estudiantes', 9, 'f'),
 ('Fuentes con dato', 8, 'f'), ('ICD sin tope', 9, 'f'), ('Tope por reglas', 9, 'f'), ('ICD', 9, 'f'), ('Estado', 20, 'f'), ('Regla aplicada', 40, 'f'),
]
head(R, 1, [c[0] for c in cols], [c[1] for c in cols])
R.freeze_panes = 'E2'
ej = [
 (2027, 1, 'EJEMPLO Docente A', 'Transición', 10, 10, 10, 10, 6, 6, 21, 2.6, 4.3, 0.78, 2, 0.48, 22, 6, 6, 5, 1, 4.5, 20),
 (2027, 1, 'EJEMPLO Docente B', '3° Integrada', 10, 8, 10, 8, 6, 5, 15, 1.8, 3.4, 0.66, 2, 0.31, 26, 4, 3, 3, 1, 3.9, 25),
 (2027, 1, 'EJEMPLO Docente C', '8° Matemáticas', 10, 6, 10, 5, 6, 3, 10, 1.2, 2.6, '', 1, 0.15, 30, '', '', 2, 1, 3.2, 28),
 (2027, 2, 'EJEMPLO Docente A', 'Transición', 9, 9, 9, 9, 6, 6, 22, 2.8, 4.5, 0.81, 2, 0.52, 22, 6, 6, 5, 1, '', ''),
 (2027, 2, 'EJEMPLO Docente B', '3° Integrada', 9, 9, 9, 9, 6, 6, 18, 2.2, 3.8, 0.52, 2, 0.35, 26, 4, 4, 4, 1, '', ''),
 (2027, 2, 'EJEMPLO Docente C', '8° Matemáticas', 9, 8, 9, 7, 6, 5, 14, 1.8, 3.1, 0.7, 2, 0.24, 30, '', '', 3, 1, '', ''),
 (2028, 1, 'EJEMPLO Docente B', '3° Integrada', 10, 10, 10, 10, 6, 6, 20, 2.5, 4.0, 0.74, 2, 0.41, 25, 4, 4, 4, 1, 4.2, 24),
 (2028, 1, 'EJEMPLO Docente C', '8° Matemáticas', 10, 9, 10, 9, 6, 6, 17, 2.1, 3.5, 0.69, 2, 0.30, 29, '', '', 4, 1, 3.8, 27),
]
NROW = 300
for r in range(2, NROW + 2):
    v = ej[r - 2] if r - 2 < len(ej) else None
    for j, (name, w, kind) in enumerate(cols, 1):
        c = R.cell(r, j); c.border = B; c.font = F()
        if kind == 'in':
            c.fill = INP; c.font = F(color='0000FF')
            if v is not None and v[j - 1] != '': c.value = v[j - 1]
    q = lambda col: f'{col}{r}'
    E,Fc,G,Hh,I,Jj,K,Lc,M,N,O,Pp,Q,Rr,S,T,U,V,Wc = [q(x) for x in 'E F G H I J K L M N O P Q R S T U V W'.split()]
    form = {
     'X': f'=IF(N({E})>0,MIN(100,{Fc}/{E}*100),"")',
     'Y': f'=IF(N({G})>0,MIN(100,{Hh}/{G}*100),"")',
     'Z': f'=IF(N({I})>0,MIN(100,{Jj}/{I}*100),"")',
     'AA': f'=IF({K}="","",{K}/24*100)',
     'AB': f'=IF({Lc}="","",{Lc}/3*100)',
     'AC': f'=IF(OR({M}="",AND({N}<>"",N({N})<{KMIN})),"",MAX(0,MIN(100,({M}-1)/4*100)))',
     'AD': f'=IF(OR({Pp}="",N({Q})=0),"",MAX(0,MIN(100,(({Q}/({Q}+{KC}))*{Pp}+({KC}/({Q}+{KC}))*{GM}-0.1)/0.4*100)))',
     'AE': f'=IF(N({Rr})>0,MIN(100,{S}/{Rr}*100),"")',
     'AF': f'=IF(N({U})>0,MIN(100,{T}/({U}*5)*100),"")',
     'AG': f'=IF(OR({V}="",N({Wc})<10),"",({V}-1)/4*100)',
     'AH': f'=IF($C{r}="","",COUNT(X{r}:AG{r}))',
    }
    comps = ['X','Y','Z','AA','AB','AC','AD','AE','AF','AG']; ws_ = ['C1','C2','C3','C4','C5','C6','C7','C8','C9','C10']
    num = '+'.join(f'IF(ISNUMBER({c}{r}),{c}{r}*{W[w]},0)' for c, w in zip(comps, ws_))
    den = '+'.join(f'IF(ISNUMBER({c}{r}),{W[w]},0)' for c, w in zip(comps, ws_))
    form['AI'] = f'=IF(OR($C{r}="",N(AH{r})<{MINF}),"",({num})/({den}))'
    form['AJ'] = f'=IF(AND(ISNUMBER(Y{r}),N(Y{r})<60),69.9,IF(OR(AND(ISNUMBER(AE{r}),N(AE{r})<80),AND(ISNUMBER(AC{r}),N(AC{r})<50,N({O})>=2)),84.9,100))'
    form['AK'] = f'=IF(AI{r}="","",MIN(AI{r},AJ{r}))'
    form['AL'] = (f'=IF($C{r}="","",IF(AK{r}="","Gris — menos de {3} fuentes",'
                  f'IF(AND(AK{r}<{AMAR},{N}<>"",N({N})<{KMIN},N(Y{r})>=60),"Gris — repetir observación",'
                  f'IF(AK{r}>={VERDE},"Verde",IF(AK{r}>={AMAR},"Amarillo","Rojo")))))')
    form['AM'] = (f'=IF($C{r}="","",IF(AND(ISNUMBER(Y{r}),N(Y{r})<60),"Ejecución < 60 %: rojo automático",'
                  f'IF(AND(ISNUMBER(AE{r}),N(AE{r})<80),"PIAR < 80 %: máximo amarillo",'
                  f'IF(AND(ISNUMBER(AC{r}),N(AC{r})<50,N({O})>=2),"Observación < 50: máximo amarillo",'
                  f'IF(AND({N}<>"",N({N})<{KMIN}),"κ < 0,60: observación descartada, repetir","")))))')
    for col, fx in form.items():
        c = R[f'{col}{r}']; c.value = fx
        c.number_format = '0.0'
R.cell(1, 14).comment = Comment('Kappa ponderado entre dos observadores (lo calcula el aplicativo). Si es < 0,60 la observación no cuenta.', 'CENTEC')
R.cell(1, 16).comment = Comment('Promedio de g = (post − pre)/(100 − pre) por estudiante, excluyendo pre > 90.', 'CENTEC')
for col, color in [('Verde', 'D7F0DF'), ('Amarillo', 'FBEFD2'), ('Rojo', 'F7D9D5'), ('Gris', 'E6E9EC')]:
    R.conditional_formatting.add(f'AL2:AL{NROW+1}', FormulaRule(formula=[f'LEFT($AL2,{len(col)})="{col}"'], fill=PatternFill('solid', fgColor=color)))
dv = DataValidation(type='whole', operator='between', formula1='1', formula2='4', showErrorMessage=True, errorTitle='Período', error='El período va de 1 a 4'); R.add_data_validation(dv); dv.add(f'B2:B{NROW+1}')
dv2 = DataValidation(type='decimal', operator='between', formula1='1', formula2='5'); R.add_data_validation(dv2); dv2.add(f'M2:M{NROW+1}'); dv2.add(f'V2:V{NROW+1}')

# ---------- Tablero ----------
T = wb.create_sheet('Tablero')
T['A1'] = 'TABLERO DEL AÑO'; T['A1'].font = Font(name='Arial', size=14, bold=True, color=NAVY)
T['A3'] = 'Año a analizar'; T['B3'] = 2027; T['B3'].fill = INP; T['B3'].font = F(color='0000FF', bold=True)
T['A4'] = 'Período (0 = año completo)'; T['B4'] = 0; T['B4'].fill = INP; T['B4'].font = F(color='0000FF', bold=True)
for a in ('A3', 'A4'): T[a].font = F(bold=True)
RR = lambda col: f'Registro!${col}$2:${col}${NROW+1}'
cond = f'{RR("A")},$B$3,{RR("B")},IF($B$4=0,">0",$B$4)'
T['A6'] = 'ICD institucional'; T['B6'] = f'=IFERROR(AVERAGEIFS({RR("AK")},{cond}),"—")'
T['A7'] = 'Registros en Verde'; T['B7'] = f'=COUNTIFS({cond},{RR("AL")},"Verde")'
T['A8'] = 'Registros en Amarillo'; T['B8'] = f'=COUNTIFS({cond},{RR("AL")},"Amarillo")'
T['A9'] = 'Registros en Rojo'; T['B9'] = f'=COUNTIFS({cond},{RR("AL")},"Rojo")'
T['A10'] = 'Registros en Gris (faltan datos)'; T['B10'] = f'=COUNTIFS({cond},{RR("AL")},"Gris*")'
for i in range(6, 11): T[f'A{i}'].font = F(bold=True); T[f'B{i}'].font = F(bold=True); T[f'B{i}'].number_format = '0.0'
head(T, 12, ['Componente (promedio institucional)', 'Valor', 'Meta / lectura'], [40, 12, 50])
names = [c['codigo'] + ' ' + c['nombre'] for c in IND['componentes']]
for i, (nm, col) in enumerate(zip(names, ['X','Y','Z','AA','AB','AC','AD','AE','AF','AG']), 13):
    T.cell(i, 1, nm).font = F(); c = T.cell(i, 2, f'=IFERROR(AVERAGEIFS({RR(col)},{cond}),"—")'); c.number_format = '0.0'; c.font = F()
    T.cell(i, 3, '≥ 85 verde · 70–84 amarillo · < 70 rojo').font = F(color='666666')
docs = sorted(set(e[2] for e in ej))
head(T, 25, ['Docente', 'ICD del año/período', 'Estado'])
T['D25'] = 'Escriba o pegue los nombres de los docentes en la columna A'; T['D25'].font = F(italic=True, color='666666')
for i in range(26, 66):
    d = docs[i - 26] if i - 26 < len(docs) else None
    c = T.cell(i, 1, d); c.fill = INP; c.font = F(color='0000FF'); c.border = B
    T.cell(i, 2, f'=IF(A{i}="","",IFERROR(AVERAGEIFS({RR("AK")},{cond},{RR("C")},A{i}),"Sin datos"))').number_format = '0.0'
    T.cell(i, 3, f'=IF(OR(A{i}="",NOT(ISNUMBER(B{i}))),"",IF(B{i}>={VERDE},"Verde",IF(B{i}>={AMAR},"Amarillo","Rojo")))')
    for j in (2, 3): T.cell(i, j).border = B; T.cell(i, j).font = F()
for col, color in [('Verde', 'D7F0DF'), ('Amarillo', 'FBEFD2'), ('Rojo', 'F7D9D5')]:
    T.conditional_formatting.add('C26:C65', FormulaRule(formula=[f'$C26="{col}"'], fill=PatternFill('solid', fgColor=color)))

# ---------- Año vs año ----------
A = wb.create_sheet('Año vs año')
A['A1'] = 'COMPARATIVO INTERANUAL (mismas fórmulas, misma escala)'; A['A1'].font = Font(name='Arial', size=14, bold=True, color=NAVY)
A['A2'] = 'Una variación ≥ 5 puntos se considera cambio real. Agregue años en la fila 4 (texto).'; A['A2'].font = F(italic=True)
years = ['2027', '2028', '2029', '2030', '2031']
head(A, 4, ['Indicador'] + years + ['Δ último año con dato', 'Tendencia'], [40, 10, 10, 10, 10, 10, 16, 14])
rows = [('ICD institucional', 'AK')] + list(zip(names, ['X','Y','Z','AA','AB','AC','AD','AE','AF','AG']))
for i, (nm, col) in enumerate(rows, 5):
    A.cell(i, 1, nm).font = F(bold=(i == 5))
    for j, y in enumerate(years, 2):
        c = A.cell(i, j, f'=IFERROR(AVERAGEIFS({RR(col)},{RR("A")},VALUE({L(j)}$4)),"")'); c.number_format = '0.0'; c.font = F(); c.border = B
    # último par de años con dato
    A.cell(i, 7, f'=IFERROR(LOOKUP(2,1/ISNUMBER(B{i}:F{i}),B{i}:F{i})-INDEX(B{i}:F{i},MATCH(2,1/ISNUMBER(B{i}:F{i}))-1),"")').number_format = '+0.0;-0.0;0.0'
    A.cell(i, 8, f'=IF(G{i}="","—",IF(G{i}>=5,"↑ mejora",IF(G{i}<=-5,"↓ retroceso","= estable")))')
    for j in (7, 8): A.cell(i, j).font = F(); A.cell(i, j).border = B
A.cell(17, 1, 'Docentes en rojo (registros)').font = F()
for j, y in enumerate(years, 2):
    A.cell(17, j, f'=COUNTIFS({RR("A")},VALUE({L(j)}$4),{RR("AL")},"Rojo")').font = F()

# ---------- Lecciones ----------
Le = wb.create_sheet('Lecciones')
head(Le, 1, ['Año', 'Indicador', 'Meta', 'Resultado', 'Brecha', 'Causa raíz (5 porqués)', 'Decisión', 'Acción para el año siguiente', 'Responsable', 'Fecha de verificación'], [7, 30, 9, 10, 9, 45, 12, 45, 18, 14])
dvd = DataValidation(type='list', formula1='"Mantener,Ajustar,Eliminar,Escalar"'); Le.add_data_validation(dvd); dvd.add('G2:G200')
Le.append([2027, 'EJEMPLO: C2 Ejecución', 90, 84, None, 'Semanas de evaluación y eventos no contemplados en la malla', 'Ajustar', 'Reservar 1 semana de margen por período en la malla 2028', 'Coordinación académica', '2028-04-15'])
for r in range(2, 201):
    Le[f'E{r}'] = f'=IF(OR(C{r}="",D{r}=""),"",D{r}-C{r})'
    for j in range(1, 11):
        c = Le.cell(r, j); c.border = B; c.font = F(color='0000FF') if j != 5 else F(); c.alignment = Alignment(wrap_text=True, vertical='top')
        if j != 5: c.fill = INP
wb.save(OUT); print('ok', OUT)
