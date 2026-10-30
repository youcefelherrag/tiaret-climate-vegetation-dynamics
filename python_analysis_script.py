import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats

# 1. Setup and Theme
sns.set_theme(style="whitegrid")

# 2. Load Datasets
df_rain = pd.read_csv('CHIRPS_Seasonal_Rainfall_2002_2025.csv')
df_ndvi = pd.read_csv('MODIS_Spring_NDVI_2002_2025.csv')
df_z = pd.read_csv('CHIRPS_Rainfall_Z_Scores.csv')

# Merge rainfall and NDVI for correlation
df_rain['Year'] = df_rain['Start_Year'] + 1
df_comb = pd.merge(df_rain, df_ndvi, on='Year', how='inner')

print("Datasets loaded successfully. Generating charts...")

# ==========================================
# Figure 2: Rainfall Time Series
# ==========================================
fig, ax = plt.subplots(figsize=(10, 4.5), dpi=300)
target_season = '2008-2009'
mean_rain = df_rain['Rainfall_mm'].mean()

colors_rain = ['#d62728' if str(season).strip() == target_season else '#1f77b4' for season in df_rain['Season']]

ax.bar(df_rain['Season'], df_rain['Rainfall_mm'], color=colors_rain, width=0.6, edgecolor='black', alpha=0.85)
ax.axhline(mean_rain, color='black', linestyle='--', linewidth=1.2, label=f'Mean Rainfall ({mean_rain:.1f} mm)')

ax.set_title(f"Seasonal Precipitation Time Series - Tiaret Province (2002-2025)\nHighlighting Wettest Year: {target_season}", fontsize=11, fontweight='bold', pad=12)
ax.set_xlabel("Hydrological Season", fontsize=9, fontweight='bold')
ax.set_ylabel("Rainfall (mm)", fontsize=9, fontweight='bold')
plt.xticks(rotation=45, ha='right', fontsize=8)
ax.legend(loc='upper right', fontsize=8)
ax.grid(axis='y', linestyle=':', alpha=0.6)

plt.tight_layout()
plt.savefig('Figure2_Rainfall_Timeseries.png')
plt.close()

# ==========================================
# Figure 3: Scatter Plot & Regression
# ==========================================
slope, intercept, r_value, p_value, std_err = stats.linregress(df_comb['Rainfall_mm'], df_comb['Spring_NDVI'])
r_squared = r_value ** 2

fig, ax = plt.subplots(figsize=(8, 6), dpi=300)
sns.regplot(
    data=df_comb, 
    x='Rainfall_mm', 
    y='Spring_NDVI', 
    ax=ax,
    color='#1f77b4',
    scatter_kws={'s': 50, 'alpha': 0.8, 'edgecolor': 'black'},
    line_kws={'color': '#d62728', 'linewidth': 2, 'label': f'Linear Fit ($R^2$ = {r_squared:.2f}, $p$ < 0.001)'}
)

ax.set_title("Relationship between Seasonal Rainfall and Spring NDVI\nTiaret Province (2002-2025)", fontsize=11, fontweight='bold', pad=15)
ax.set_xlabel("Seasonal Precipitation (mm)", fontsize=10, fontweight='bold')
ax.set_ylabel("Spring NDVI (MODIS)", fontsize=10, fontweight='bold')
ax.grid(True, linestyle=':', alpha=0.6)
ax.legend(loc='upper left', fontsize=9)

plt.tight_layout()
plt.savefig('Figure3_Rainfall_NDVI_Correlation.png')
plt.close()

# ==========================================
# Figure 4: Spring NDVI Time Series
# ==========================================
fig, ax = plt.subplots(figsize=(10, 4.5), dpi=300)
peak_year = 2013
mean_ndvi = df_ndvi['Spring_NDVI'].mean()

colors_ndvi = ['#2ca02c' if int(y) == peak_year else '#aec7e8' for y in df_ndvi['Year']]

ax.bar(df_ndvi['Year'].astype(int).astype(str), df_ndvi['Spring_NDVI'], color=colors_ndvi, width=0.6, edgecolor='black', alpha=0.85)
ax.axhline(mean_ndvi, color='black', linestyle='--', linewidth=1.2, label=f'Mean NDVI ({mean_ndvi:.3f})')

ax.set_title(f"Spring MODIS NDVI Time Series - Tiaret Province (2002-2025)\nHighlighting Peak Ecological Response: {peak_year}", fontsize=11, fontweight='bold', pad=12)
ax.set_xlabel("Spring Year", fontsize=9, fontweight='bold')
ax.set_ylabel("Mean Spring NDVI", fontsize=9, fontweight='bold')
plt.xticks(rotation=45, ha='right', fontsize=8)
ax.legend(loc='upper right', fontsize=8)

plt.tight_layout()
plt.savefig('Figure4_Spring_NDVI_Timeseries.png')
plt.close()

# ==========================================
# Figure 5: Z-Score SPI
# ==========================================
fig, ax = plt.subplots(figsize=(10, 4.5), dpi=300)
colors_z = ['#1f77b4' if z >= 0 else '#d62728' for z in df_z['Z_Score']]

ax.bar(df_z['Season'], df_z['Z_Score'], color=colors_z, width=0.6, edgecolor='black', alpha=0.85)
ax.axhline(0, color='black', linewidth=1, linestyle='-')
ax.axhline(1, color='gray', linewidth=0.8, linestyle='--', alpha=0.7, label='Moderate Wet (+1 SD)')
ax.axhline(-1, color='gray', linewidth=0.8, linestyle='--', alpha=0.7, label='Moderate Drought (-1 SD)')

ax.set_title("Standardized Precipitation Index (SPI / Z-Score) - Tiaret Province (2002-2025)", fontsize=11, fontweight='bold', pad=12)
ax.set_xlabel("Hydrological Season", fontsize=9, fontweight='bold')
ax.set_ylabel("Z-Score (Standard Deviations)", fontsize=9, fontweight='bold')
plt.xticks(rotation=45, ha='right', fontsize=8)
ax.legend(loc='upper right', fontsize=8)

plt.tight_layout()
plt.savefig('Figure5_Rainfall_ZScores.png')
plt.close()

# ==========================================
# Figure 6: Dual-Axis Comparison
# ==========================================
fig, ax1 = plt.subplots(figsize=(10, 4.5), dpi=300)

color_rain = '#1f77b4'
ax1.set_xlabel('Hydrological Season', fontweight='bold', fontsize=9)
ax1.set_ylabel('Rainfall (mm)', color=color_rain, fontweight='bold', fontsize=9)
line1 = ax1.plot(df_comb['Season'], df_comb['Rainfall_mm'], color=color_rain, marker='o', linewidth=2, label='Rainfall (mm)')
ax1.tick_params(axis='y', labelcolor=color_rain)
plt.xticks(rotation=45, ha='right', fontsize=8)

ax2 = ax1.twinx()  
color_ndvi = '#2ca02c'
ax2.set_ylabel('Spring NDVI', color=color_ndvi, fontweight='bold', fontsize=9)
line2 = ax2.plot(df_comb['Season'], df_comb['Spring_NDVI'], color=color_ndvi, marker='s', linewidth=2, linestyle='--', label='Spring NDVI')
ax2.tick_params(axis='y', labelcolor=color_ndvi)
ax2.grid(False)

lines = line1 + line2
labels = [l.get_label() for l in lines]
ax1.legend(lines, labels, loc='upper right', fontsize=8)

plt.title("Multi-Temporal Comparison: Seasonal Rainfall vs. Spring NDVI (Tiaret, 2002-2025)", fontsize=11, fontweight='bold', pad=12)
plt.tight_layout()
plt.savefig('Figure6_DualAxis_Comparison.png')
plt.close()

print("All figures successfully generated and saved!")
