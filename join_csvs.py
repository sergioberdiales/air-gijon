import pandas as pd
import os
import re

# Ruta donde están los CSVs (usa el path real de tu carpeta)
ruta_csvs = os.path.join(os.getcwd(), "air_data_csv")

# Filtrar solo archivos que siguen el patrón "aire_20*.csv"
archivos_csv = [f for f in os.listdir(ruta_csvs) if re.match(r"aire_20\d{2}\.csv", f)]

# Crear una lista para almacenar los DataFrames
dfs = []

# Leer y concatenar los archivos CSV
for archivo in archivos_csv:
    ruta_completa = os.path.join(ruta_csvs, archivo)
    print(f"Procesando: {archivo}")
    df = pd.read_csv(ruta_completa, encoding="utf-8", low_memory=False)
    df["fuente_archivo"] = archivo  # Para saber de qué año viene cada dato
    dfs.append(df)

# Concatenar todos los DataFrames en uno solo
df_joined = pd.concat(dfs, ignore_index=True)

# Modificamos los valores de "Periodo" para pasar de formato "1-24" a "0-23"
df_joined["Periodo"] = df_joined["Periodo"].apply(lambda x: x - 1)

# DataFrame final
df_final = df_joined

# Guardar el archivo unificado
ruta_salida = os.path.join(ruta_csvs, "aire_todos_los_anios.csv")
df_final.to_csv(ruta_salida, index=False, encoding="utf-8")

print(f"✅ Archivo combinado guardado en: {ruta_salida}")