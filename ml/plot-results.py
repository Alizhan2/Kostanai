"""Export shareable figures from the saved holdout predictions."""
from pathlib import Path
import argparse
import json
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.calibration import calibration_curve
from sklearn.metrics import precision_recall_curve

ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument("--results",type=Path,default=ROOT/"results")
args=parser.parse_args()
report=json.loads((args.results/"report.json").read_text())
data=pd.read_csv(args.results/"holdout-predictions.csv")
observed=report["source"]=="observed"
plt.rcParams.update({"font.family":"DejaVu Sans","font.size":10,
                     "axes.spines.top":False,"axes.spines.right":False})
fig,axes=plt.subplots(2,2,figsize=(12,8),layout="constrained")
fig.suptitle("Allur Plant Twin · " + ("оценка на внешней истории" if observed else "оценка на синтетических сменах"),
             fontsize=17,fontweight="bold")
ax=axes[0,0]
keys=["precision","recall","f1"];x=np.arange(len(keys))
ax.bar(x-.18,[report["holdout"][k] for k in keys],.36,label="Обученный лес",color="#86ad33")
ax.bar(x+.18,[report["baseline"][k] for k in keys],.36,label="Баланс потоков",color="#5389d8")
ax.set_xticks(x,["Точность предупреждений","Полнота","F1"])
ax.set_ylim(0,1);ax.legend(fontsize=9);ax.set_title("Сравнение при выбранных порогах")
ax.grid(axis="y",alpha=.2);ax.set_axisbelow(True)
ax=axes[0,1]
precision,recall,_=precision_recall_curve(data.stop_within_60m,data.calibrated_probability)
ax.plot(recall,precision,color="#86ad33",lw=2,label=f'AP = {report["holdout"]["average_precision"]:.3f}')
ax.axhline(data.stop_within_60m.mean(),color="#aab4bf",ls="--",label="Доля событий")
ax.set_xlim(0,1);ax.set_ylim(0,1);ax.set_xlabel("Полнота");ax.set_ylabel("Точность")
ax.set_title("Кривая precision–recall");ax.legend();ax.grid(alpha=.15)
ax=axes[1,0]
observed,predicted=calibration_curve(data.stop_within_60m,data.calibrated_probability,n_bins=8,strategy="quantile")
ax.plot([0,1],[0,1],color="#aab4bf",ls="--")
ax.plot(predicted,observed,"o-",color="#5389d8")
ax.set_xlim(0,1);ax.set_ylim(0,1);ax.set_xlabel("Средняя оценка модели")
ax.set_ylabel("Наблюдаемая доля событий");ax.set_title(f'Калибровка · Brier = {report["holdout"]["brier_score"]:.3f}')
ax.grid(alpha=.15)
ax=axes[1,1]
labels={"buffer":"Буфер","demand_per_hour":"Расход","supply_per_hour":"Подача",
        "net_deficit_per_hour":"Дефицит","coverage_minutes":"Запас в минутах",
        "buffer_trend_per_hour":"Тренд буфера","flow_std_per_hour":"Изменчивость потока",
        "mean_flow_per_hour":"Среднее изменение"}
importance=sorted(report["feature_importance_validation"],key=lambda r:r["mean_ap_decrease"])
ax.barh([labels[r["feature"]] for r in importance],[r["mean_ap_decrease"] for r in importance],
        xerr=[r["std"] for r in importance],color="#86ad33")
ax.set_title("Важность признаков · выборка настройки")
ax.set_xlabel("Снижение AP после перестановки признака")
ax.grid(axis="x",alpha=.15);ax.set_axisbelow(True)
note=("Внешняя история; происхождение и метки требуют подтверждения." if observed else
      "Синтетические данные; метрики не подтверждают качество на предприятии.")
fig.supxlabel(f'{report["split"]["holdout"]["episodes"]} отложенных смен. {note}',fontsize=10)
for extension in ["png","pdf"]:
    fig.savefig(args.results/f"evaluation.{extension}",dpi=180)
print(args.results/"evaluation.png")
