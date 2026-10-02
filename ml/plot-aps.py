"""Create standalone figures for the saved Scania APS evaluation."""
from pathlib import Path
import json
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.calibration import calibration_curve
from sklearn.metrics import precision_recall_curve

OUT=Path(__file__).resolve().parent/"results/aps"
report=json.loads((OUT/"report.json").read_text())
data=pd.read_csv(OUT/"holdout-predictions.csv")
plt.rcParams.update({"font.family":"DejaVu Sans","font.size":10,
                     "axes.spines.top":False,"axes.spines.right":False})
fig,axes=plt.subplots(2,2,figsize=(12,8),layout="constrained")
fig.suptitle("Scania APS · реальные эксплуатационные записи",fontsize=17,fontweight="bold")
matrix=np.asarray(report["holdout"]["confusion_matrix"])
rates=matrix/matrix.sum(axis=1,keepdims=True)
ax=axes[0,0];ax.imshow(rates,cmap="Greens",vmin=0,vmax=1)
for i in range(2):
    for j in range(2):
        ax.text(j,i,f'{matrix[i,j]:,}\n{rates[i,j]:.1%}',ha="center",va="center",
                fontsize=14,color="white" if rates[i,j]>.5 else "#18212c")
ax.set_xticks([0,1],["Другой компонент","APS"]);ax.set_yticks([0,1],["Другой компонент","APS"])
ax.set_xlabel("Класс модели");ax.set_ylabel("Эталон датасета");ax.set_title("Матрица ошибок · 16 000 записей")
ax=axes[0,1]
precision,recall,_=precision_recall_curve(data.aps_fault,data.calibrated_probability)
ax.plot(recall,precision,color="#86ad33",lw=2,label=f'AP = {report["holdout"]["average_precision"]:.3f}')
ax.scatter([report["holdout"]["recall"]],[report["holdout"]["precision"]],color="#5389d8",label="Выбранный порог",zorder=3)
ax.axhline(data.aps_fault.mean(),color="#aab4bf",ls="--",label="Доля APS: 2,34%")
ax.set_xlim(0,1);ax.set_ylim(0,1);ax.set_xlabel("Полнота");ax.set_ylabel("Точность предупреждений")
ax.set_title("Кривая precision–recall");ax.legend();ax.grid(alpha=.15)
ax=axes[1,0]
costs=[report["always_non_APS"]["challenge_cost"],report["holdout"]["challenge_cost"]]
bars=ax.bar(["Всегда другой компонент","Обученная модель"],costs,color=["#aab4bf","#86ad33"])
ax.bar_label(bars,[f'{cost:,}' for cost in costs],padding=5)
ax.set_ylim(0,max(costs)*1.15);ax.set_ylabel("Условные единицы задания")
ax.set_title("Стоимость: 10 × ложная тревога + 500 × пропуск")
ax.grid(axis="y",alpha=.15);ax.set_axisbelow(True)
ax=axes[1,1]
observed,predicted=calibration_curve(data.aps_fault,data.calibrated_probability,n_bins=8,strategy="uniform")
ax.plot([0,1],[0,1],color="#aab4bf",ls="--");ax.plot(predicted,observed,"o-",color="#5389d8")
ax.set_xlim(0,1);ax.set_ylim(0,1);ax.set_xlabel("Средняя оценка класса APS")
ax.set_ylabel("Наблюдаемая доля APS");ax.grid(alpha=.15)
ax.set_title(f'Калибровка · Brier = {report["holdout"]["brier_score"]:.4f}')
fig.supxlabel("Scania CV AB, 2016 · GPL-3.0-or-later. Другой компонент означает другую неисправность, не исправный грузовик.\n"
              "Диагностика класса неисправности; качество на оборудовании Allur неизвестно.",fontsize=10)
for extension in ["png","pdf"]:
    fig.savefig(OUT/f"evaluation.{extension}",dpi=180)
print(OUT/"evaluation.png")
