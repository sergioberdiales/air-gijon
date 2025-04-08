import pandas as pd

# Ruta del archivo original (ajústala según tu sistema)
file_path = "air_data_csv/aire_todos_los_anios.csv"


# Cargar solo las últimas 100 filas del CSV
df = pd.read_csv(file_path, encoding="utf-8", low_memory=False).tail(100)

# Guardar en un nuevo archivo CSV con el nombre "aire_mediciones_muestra.csv"
sample_file_path = "air_data_csv/aire_mediciones_muestra.csv"
df.to_csv(sample_file_path, index=False, encoding="utf-8")

print(f"✅ Archivo creado: {sample_file_path}")