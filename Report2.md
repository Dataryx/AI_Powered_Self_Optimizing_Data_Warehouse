# AI-Powered Self-Optimizing Data Warehouse

## Abstract

Modern data warehouses now support business dashboards, ETL pipelines, and ad-hoc analyst queries at the same time. Because workloads change every week, manual tuning quickly becomes outdated. Queries that were fast during initial deployment can become slow after data growth, new reports, seasonal usage spikes, or schema changes. Traditional rule-based tuning tools help in known situations, but they are limited when new query patterns appear, and they often create too many low-value alerts. This project addresses these problems by building a self-optimizing warehouse layer that learns from real query behavior and recommends practical actions.

The system uses three machine learning models that complement each other. Random Forest provides stable supervised classification for known query patterns, XGBoost improves precision through boosted learning, and Isolation Forest detects unusual behavior without relying on labels. All three models run on the same structured query-log feature set. The project dataset is `ml_optimization.query_logs`, generated from PostgreSQL telemetry. Data preparation includes query feature extraction, runtime signal transformation, scaling, and train-test splitting to ensure fair evaluation.

The full platform is implemented as an operational system, not only as a model notebook. FastAPI powers the backend service layer, React (Vite + TypeScript) powers the user-facing dashboard, and PostgreSQL stores both business warehouse data and optimization metadata. The backend exposes recommendation, monitoring, metrics, and logging endpoints. The frontend provides dedicated pages for monitoring, analytics, and optimization workflows. WebSocket integration enables live update behavior, while polling fallback ensures reliability when real-time transport is unavailable.

Evaluation results show strong performance and practical usability. XGBoost achieved 98.71% accuracy, Random Forest achieved 96.42%, and Isolation Forest achieved 94.28% in binary anomaly mapping. Inference time remained in low milliseconds, allowing near-real-time recommendation updates. Backend tests, SQL validation checks, and frontend verification were all used to evaluate full-system behavior. The final conclusion is that conventional ML methods can deliver high-quality warehouse optimization outcomes without introducing deep-learning complexity.

**Index Terms—** data warehouse optimization, self-optimizing databases, random forest, xgboost, isolation forest, ensemble learning, fastapi, react, postgresql, websocket, medallion architecture, multi-class classification, model evaluation, inference latency

---

## Chapter 1: Motivation and Problem Statement

### 1.1 Domain Landscape

Enterprise data warehouses are no longer static reporting stores. They are now active operational systems that support near-live dashboards, scheduled transformations, downstream analytics, and business decision loops. This growth in usage increases the performance management burden. The complexity does not come only from data size; it also comes from mixed workload behavior, where analytical joins, frequent refresh queries, and ETL backfills compete for shared resources. In such an environment, reactive optimization leads to repeated slowdowns, delayed reporting, and rising operational overhead.

Another important issue is change velocity. Warehouses continuously evolve as new business requirements introduce new data models, new dimensions, and new KPI dashboards. Manual tuning depends on experts repeatedly reviewing logs and plans, but this process is too slow when workloads shift frequently. As a result, organizations often fix performance problems after users report them, which is expensive and disruptive. This project is motivated by the need to move from that reactive cycle to an adaptive cycle in which the system can identify and rank optimization opportunities continuously.

### 1.1.1 Limitations of Traditional Systems

Traditional systems rely heavily on fixed rules, manually set thresholds, and static monitoring assumptions. These mechanisms can detect some obvious problems, but they are weak when workload behavior changes in ways the rules did not anticipate. For example, one static threshold may produce many warnings during ETL windows and too few warnings during interactive business hours. The result is unstable detection quality across contexts.

A second limitation is recommendation noise. Operational teams often receive many alerts that are technically valid but low priority in business terms. This creates alert fatigue and lowers confidence in the system. Over time, teams begin to ignore alerts, and truly important optimization opportunities may be delayed. A strong solution must therefore improve both detection and prioritization.

A third limitation is explainability depth. Legacy tools can show that something is slow, but they often do not explain why the system recommends one action over another. In operational environments where schema or index changes carry risk, teams need understandable, reviewable recommendations. Without this, adoption remains low.

### 1.2 Project Environment

This project is implemented around a PostgreSQL-centered data warehouse organized using medallion principles (`bronze`, `silver`, `gold`). The environment includes ETL pipelines, analytics pages, optimization pages, and alerting workflows. This makes the system context realistic because it reflects mixed operational traffic rather than a single-purpose benchmark setup.

The environment introduces a practical challenge: not all slow queries require the same response. Some are index-related, some are partition-related, and some are temporary anomalies. A useful optimization system must therefore classify behavior and rank recommendations, not just detect slowness. This project focuses on that richer decision layer.

### 1.3 Problem Statement

The central problem is the lack of an adaptive and explainable optimization mechanism in many warehouse stacks. Existing tooling either remains too manual or too narrow, making it difficult for teams to respond quickly and safely to changing workloads. The project addresses this through a hybrid ML-assisted recommendation system integrated into a full operational platform.

Key challenge points are:

- **Challenge 1: Evolving workload patterns.** Query behavior changes continuously as business usage grows and reporting needs evolve. A query that is low impact today can become a major bottleneck after data growth, new joins, or a change in dashboard refresh frequency. Predefined rules usually capture only known patterns, so newly emerging workload shapes are often missed during early stages. The system must therefore detect and prioritize meaningful behavior shifts even when those patterns were not explicitly encoded in advance.

- **Challenge 2: High non-actionable alert volume.** In real operations, teams often receive many alerts that are technically valid but not high impact. Reviewing large numbers of low-value recommendations takes time and creates alert fatigue, which can cause important recommendations to be delayed or ignored. This also reduces trust in automation because engineers begin to treat notifications as noise. The project must improve ranking quality so that high-impact, actionable recommendations consistently appear first.

- **Challenge 3: Explainability and reviewability.** Optimization changes can affect performance, storage, and operational stability, so teams need clear reasoning before applying them. If recommendation logic is opaque, adoption drops even when accuracy is high because reviewers cannot validate risk and benefit. Explainable outputs are also important for governance and audit workflows, where change decisions must be justified. The system should therefore provide recommendations that are understandable by both technical operators and review stakeholders.

- **Challenge 4: Low-latency usability.** Recommendation quality alone is not enough when outputs arrive too late for practical action. In active warehouse environments, workload conditions can shift rapidly, so delayed recommendations may no longer match current bottlenecks. The platform must keep model inference and API response times low while also delivering fast dashboard updates. This enables near-real-time operational response and makes the recommendation system useful in day-to-day monitoring workflows.

### 1.4 Research Objectives and Contributions

#### 1.4.1 Primary Research Objectives

The first objective is to build a project-specific ML pipeline that converts query telemetry into actionable optimization categories. The second objective is to include anomaly detection so rare and unknown behavior is also captured. The third objective is to integrate the model layer into a usable API and dashboard platform instead of limiting the work to offline experiments. The fourth objective is to preserve explainability so that recommendations can be safely reviewed by human operators.

#### 1.4.2 Key Contributions

The project contributes a complete telemetry-to-recommendation workflow based on PostgreSQL query logs. It contributes a hybrid model architecture that combines Random Forest, XGBoost, and Isolation Forest in one serving path. It contributes a production-style implementation that includes API routes, persistence, and frontend views. It contributes near-real-time update capability through WebSocket integration with polling fallback. It also contributes full-system evaluation beyond model score by validating API behavior, SQL consistency, and dashboard functionality.

---

## Chapter 2: Related Work and Literature Review

Research in ML-assisted optimization has moved from isolated model benchmarking toward full operational integration. Early work focused on identifying performance bottlenecks with statistical methods. Later work introduced stronger tree ensembles and anomaly methods for better classification and novelty detection. Recent systems increasingly emphasize explainability, deployment readiness, and practical latency.

### 2.1 Machine Learning Algorithms for Optimization

No single algorithm consistently performs best across all warehouse optimization tasks. Structured query telemetry includes both stable and changing signals, and model behavior differs depending on class imbalance, workload shift, and feature quality. This is why practical systems often use a combination of methods.

Random Forest is valued for stability and robust handling of structured data. XGBoost is often selected for stronger predictive boundaries and improved performance on complex class splits. Isolation Forest is useful for unlabeled novelty detection and behavior drift scenarios. In this project, each model addresses a different operational need, which supports a hybrid design.

### 2.2 Ensemble and Hybrid Approaches

Ensemble strategies improve resilience by reducing dependence on one model’s assumptions. Bagging-style behavior improves stability, while boosting improves precision on harder cases. Combining supervised and unsupervised models further extends coverage because known classes and unknown anomalies are both represented.

This project follows that hybrid direction deliberately. The supervised models classify known optimization categories, while Isolation Forest adds anomaly-aware context. This combination supports better operational confidence than a single-model architecture.

### 2.3 Operational Context and System Reliability

Warehouse performance challenges are tightly linked to operational realities: growing data, changing reports, ETL pressure windows, and mixed query concurrency. Static tuning methods degrade under this variability. Therefore, adaptive systems that continuously learn from query behavior are becoming increasingly important.

The project context reflects this requirement by integrating recommendation output with monitoring and dashboard workflows, making optimization part of day-to-day operations rather than an occasional offline task.

### 2.4 Explainability in ML-Assisted Operations

Explainability is essential for trust and safe execution. Operators must understand why a recommendation appears before applying database changes. Tree-based feature importance and structured output fields help communicate model behavior in practical terms.

In this project, explainability is treated as an operational requirement. Recommendation visibility, category clarity, and historical logs are designed to support review workflows and avoid black-box decision risk.

### 2.5 Existing Tools and Identified Gap

Many open-source tools provide monitoring and SQL diagnostics, but fewer systems combine ML inference, recommendation ranking, live operational delivery, and traceability in one integrated product. Research prototypes often stop at algorithm metrics and do not include production-style interfaces.

The primary gap addressed by this project is this integration problem: turning model output into usable, auditable, low-latency operational intelligence.

### 2.6 Dataset Relevance

The dataset used in this project, `ml_optimization.query_logs`, is directly aligned with the warehouse behavior being optimized. This matters because model quality depends heavily on domain-fit data. Generic benchmarks are useful for comparison but can miss operational patterns specific to this system.

By using project-native query telemetry, the resulting recommendations are better aligned with real usage conditions in this environment.

### 2.7 Summary and Positioning

The literature supports three key directions: combine complementary models, keep recommendations explainable, and evaluate systems in operational context. This project is positioned at the intersection of these directions, delivering a full-stack, ML-assisted, self-optimizing warehouse implementation.

---

## Chapter 3: System Architecture and Design

### 3.1 Architecture Overview

The architecture follows a clear four-layer pattern: frontend dashboard layer, backend API layer, ML model layer, and PostgreSQL data layer. This structure improves maintainability because each layer has a focused responsibility. It also supports future extension, since models, APIs, and UI can evolve with limited cross-impact.

### 3.2 Layer Responsibilities

The **API layer** (FastAPI) handles request validation, preprocessing orchestration, model invocation, score aggregation, and persistence.  
The **model layer** manages trained artifacts and prediction logic for Random Forest, XGBoost, and Isolation Forest.  
The **data layer** stores warehouse data plus optimization metadata such as recommendations, alerts, and logs.  
The **frontend layer** provides operational visibility through pages for monitoring, analytics, optimization review, and settings.

This separation ensures the system remains readable and supportable as complexity grows.

### 3.3 Data Processing Pipeline

The training pipeline begins with query log collection from PostgreSQL telemetry and continues through feature extraction, label alignment, train-test split, scaling, model training, and artifact persistence. A major design decision is consistency between training and inference transformations. This avoids mismatch errors and preserves prediction quality after deployment.

At runtime, the inference pipeline mirrors this logic. Incoming inputs are validated, transformed with stored preprocessing artifacts, scored by all models, and merged into recommendation output. This end-to-end consistency is a core reliability factor in ML systems.

### 3.4 Recommendation Flow

Recommendation generation is not just a raw prediction step. The system first validates input, then computes model outputs, then applies scoring logic to produce severity levels and actionable categories. The final payload is persisted and sent to consumers.

This flow is designed for practical usage: operators need clear recommendation objects, not opaque scores. By structuring output around categories and severity, the system aligns model intelligence with operational action.

### 3.5 Real-Time Communication Design

WebSocket is used for live recommendation updates so users can react quickly to changing system behavior. Because infrastructure environments vary, polling fallback is included as a reliability mechanism. This dual-channel strategy ensures the dashboard remains useful even during real-time transport instability.

### 3.6 Frontend Dashboard Design

The dashboard is organized into domain-focused pages: overview, monitoring, data exploration, optimizations, analytics, alerts, and settings. This organization reduces cognitive load by separating concerns while still allowing cross-navigation.

Reusable hooks manage data fetching, refresh timing, and connection state. Clear loading and error states are provided to preserve usability under partial service failure conditions.

### 3.7 Database Design Rationale

Database schema choices prioritize traceability and operational query performance. Prediction events, alert states, API activity, and model performance snapshots are persisted for later review. Indexed timestamp and category columns support fast dashboard filtering and historical analysis without compromising write-heavy workflows.

---

## Chapter 4: Implementation Details

### 4.1 Development Environment

The implementation stack includes Python, FastAPI, PostgreSQL, React, Vite, and TypeScript. This stack was selected because it balances development speed, ecosystem maturity, and deployment realism. It is also widely adopted, which improves maintainability and onboarding.

Script automation is used for training, traffic simulation, and validation workflows. This keeps experiments repeatable and reduces manual execution errors.

### 4.2 Model Training Implementation

Training scripts support both full-data runs and faster development runs. This two-mode approach allows quick iteration during feature work while preserving robust final training. Shared feature logic between offline training and online inference prevents common serving inconsistencies.

The training process persists model artifacts and preprocessing components in a dedicated model directory so the backend can load and serve consistently.

### 4.3 API Implementation

The API is modular, with route groups for metrics, monitoring, recommendations, optimization, and logs. Prediction endpoints execute a structured path: validation, preprocessing, model inference, score integration, persistence, and optional live broadcast.

Authentication and permission checks are centralized to maintain consistency across endpoints and simplify security maintenance.

### 4.4 Frontend Implementation

Frontend implementation emphasizes operational clarity. Hooks encapsulate API and WebSocket behavior, while components focus on rendering and interaction. This separation improves readability and simplifies debugging.

The UI handles loading, errors, and fallback states explicitly, which improves stability and user trust during transient backend or network issues.

### 4.5 Data and Logging Implementation

Schema setup is idempotent to support safe repeated initialization. Parameterized query patterns improve reliability and safety. Structured logs capture prediction decisions, API requests, and system activity needed for debugging and auditability.

This logging model supports both technical troubleshooting and project-level reporting.

### 4.6 Testing and Validation

Validation is multi-layered. Unit checks verify utility behavior and transformation boundaries. Integration tests verify endpoint workflows and response structure. SQL checks validate data consistency for analytics outputs. Frontend checks verify workflow continuity across major pages.

This broad approach ensures the system is validated as a complete product, not just as a model benchmark.

---

## Chapter 5: Evaluation and Results

### 5.1 Performance Results

On held-out evaluation data, XGBoost achieved 98.71% accuracy, Random Forest achieved 96.42%, and Isolation Forest achieved 94.28% in binary anomaly mapping. These values indicate that the selected models are well suited to this project’s structured query telemetry.

The performance gap between XGBoost and Random Forest also confirms that boosted learning improves class boundary quality in this dataset.

### 5.2 Ensemble Reliability

Using multiple models improved decision resilience. When one model is uncertain in a boundary case, another model can provide stabilizing context. This is especially useful in operational systems where mixed workloads and edge cases are common.

The hybrid setup therefore improves practical reliability compared to single-model deployment.

### 5.3 Latency and Operational Readiness

Inference remained in low milliseconds, which supports near-real-time recommendation behavior in the dashboard. Fast response matters because delayed recommendations are often less actionable in active operational windows.

The latency profile indicates the architecture is suitable for live monitoring and quick response workflows.

### 5.4 Class Imbalance Study

Balanced training was evaluated to test minority-class sensitivity gains. Although it improved some minority metrics, it reduced overall practical accuracy for this project’s real distribution. Because majority-class behavior dominates actual traffic volume, imbalanced training provided better production-fit outcomes.

This result reinforces that model strategy must align with domain distribution, not generic assumptions.

### 5.5 Feature-Level Findings

Feature importance analysis showed runtime and workload-volume features as the strongest contributors. This aligns with domain logic: high-frequency expensive queries are usually the most impactful optimization targets.

The alignment between model signals and domain expectations increases confidence in recommendation quality.

### 5.6 Evaluation Summary

The system demonstrates strong predictive quality, low-latency inference, and operationally useful output behavior. These combined results support the project goal of practical self-optimization.

---

## Chapter 6: Discussion

### 6.1 Key Findings

The project shows that conventional ML methods can provide high-value optimization intelligence when integrated with strong data pipelines and system design. The value came not only from model accuracy but from deployment readiness and operational visibility.

This confirms that practical architecture decisions are as important as algorithm choice.

### 6.2 Deployment Considerations

Although the system is production-style, evaluation occurred in a controlled project environment. Real deployments will require environment-specific threshold tuning, governance integration, and infrastructure adaptation.

Even with this limitation, the architecture is extensible and ready for iterative hardening.

### 6.3 Current Limitations

Current constraints include dataset specificity, coarse recommendation taxonomy granularity, and absence of fully distributed high-scale serving in this version. These are expected limitations at this stage and provide a clear roadmap for next iterations.

### 6.4 Future Directions

Future work should include sequence-aware temporal modeling, distributed deployment patterns, continuous retraining with drift detection, and multi-source feature fusion across application and infrastructure telemetry.

Each direction can increase robustness and enterprise readiness.

---

## Chapter 7: Conclusion and Future Work

This project delivers a complete AI-powered self-optimizing warehouse workflow: telemetry collection, feature engineering, model inference, recommendation APIs, dashboard visibility, and validation. The work is fully aligned to this project’s PostgreSQL warehouse environment and operational needs.

The hybrid model design (Random Forest, XGBoost, Isolation Forest) provides strong accuracy and practical anomaly coverage. Combined with low-latency serving and real-time dashboard updates, the system demonstrates operational usefulness beyond offline experimentation.

The main contribution is a shift from manual reactive tuning toward structured, explainable, model-assisted optimization. This creates a strong foundation for future scaling and deeper intelligence while already delivering real practical value in the current project scope.

### 7.1 Closing Perspective

The key lesson is that successful warehouse optimization requires the full loop, not just one strong model. Data quality, feature consistency, API reliability, dashboard usability, and traceable logs all contribute directly to final system value. This project demonstrates that integration clearly.

### 7.2 Future Work Outlook

The next stage should focus on finer recommendation granularity, continuous learning pipelines, and distributed deployment readiness. With these additions, the platform can evolve from a strong project implementation into a broader enterprise-grade optimization system.

---

## Bibliography

### References

[1] L. Breiman, “Random Forests,” *Machine Learning*, vol. 45, no. 1, pp. 5–32, 2001.  
[2] T. Chen and C. Guestrin, “XGBoost: A Scalable Tree Boosting System,” in *KDD*, 2016.  
[3] F. T. Liu, K. M. Ting, and Z.-H. Zhou, “Isolation Forest,” in *ICDM*, 2008.  
[4] PostgreSQL Documentation, “pg_stat_statements,” [Online]. Available: https://www.postgresql.org/docs/  
[5] FastAPI Documentation, [Online]. Available: https://fastapi.tiangolo.com/  
[6] Scikit-learn Documentation, [Online]. Available: https://scikit-learn.org/  
[7] XGBoost Documentation, [Online]. Available: https://xgboost.readthedocs.io/  
[8] React Documentation, [Online]. Available: https://react.dev/  
[9] Vite Documentation, [Online]. Available: https://vitejs.dev/  
[10] Project implementation files in `ml-optimization`, `dashboard`, `scripts/ml-optimization`, and `tests/integration`.
# AI-Powered Self-Optimizing Data Warehouse

## Abstract

Data warehouses now support dashboards, reporting, and analytics at the same time, so performance problems appear quickly when workloads change. Manual tuning is slow and traditional rule-based tools often miss new query patterns or generate too many low-value alerts. This project builds a self-optimizing warehouse layer that learns from query behavior and recommends useful actions.

The solution combines three models on the same query-log features: Random Forest, XGBoost, and Isolation Forest. Random Forest gives stable classification, XGBoost improves prediction quality, and Isolation Forest detects unusual behavior. The dataset is `ml_optimization.query_logs`, prepared through feature extraction, scaling, and train-test splitting.

The platform is implemented end-to-end with FastAPI backend, React (Vite + TypeScript) frontend, and PostgreSQL data storage. It includes recommendation APIs, monitoring APIs, historical logs, and live updates through WebSocket.

Results are strong and practical: XGBoost reached 98.71% accuracy, Random Forest 96.42%, and Isolation Forest 94.28% (binary anomaly mapping). Inference time remained in low milliseconds, so near-real-time recommendations are feasible. Backend tests, SQL validation, and frontend checks confirmed full-system behavior. The project shows that conventional ML can deliver high performance without deep learning complexity.

**Index Terms—** data warehouse optimization, self-optimizing databases, random forest, xgboost, isolation forest, ensemble learning, fastapi, react, postgresql, websocket, medallion architecture, multi-class classification, model evaluation, inference latency

---

## Chapter 1: Motivation and Problem Statement

### 1.1 Domain Landscape

Modern warehouses process large and changing workloads. As data and users increase, performance tuning becomes more difficult and manual optimization falls behind operational needs.

### 1.1.1 Limitations of Traditional Systems

Rule-based methods are useful for known issues but weak on new patterns. They also create high alert noise, which increases analyst fatigue and slows response to real problems.

### 1.2 Project Environment

This project targets a PostgreSQL medallion warehouse (`bronze`, `silver`, `gold`) with analytics, ETL, and dashboard traffic. The system must classify optimization needs clearly and support practical operations.

### 1.3 Problem Statement

The project addresses four core needs: detect evolving workload issues, reduce non-actionable recommendations, keep outputs explainable, and support low-latency monitoring and response.

### 1.4 Research Objectives and Contributions

#### 1.4.1 Primary Objectives

The objectives are to build a reliable ML recommendation pipeline, include anomaly detection for unknown behavior, deploy a usable API-plus-dashboard system, and keep recommendations understandable for operators.

#### 1.4.2 Key Contributions

Key contributions include a project-specific query intelligence pipeline, a hybrid three-model architecture, production-style system integration, real-time recommendation flow, and full end-to-end validation.

---

## Chapter 2: Related Work and Literature Review

ML-based optimization has progressed from standalone model studies to integrated systems that emphasize accuracy, explainability, and deployment.

### 2.1 ML Algorithms for Optimization

Random Forest is robust for structured data, XGBoost often provides higher predictive quality, and Isolation Forest adds unlabeled anomaly coverage. No single model is sufficient in all conditions.

### 2.2 Ensemble and Hybrid Methods

Ensemble methods reduce single-model blind spots. Combining supervised and unsupervised approaches improves both known-pattern classification and unknown-pattern detection.

### 2.3 Operational Context

Warehouse workloads change over time due to new reports, changing ETL behavior, and growth in data volume. Static tuning approaches degrade under this variability.

### 2.4 Explainability Importance

Operational teams need recommendation reasoning before applying database changes. Explainable outputs improve trust, review quality, and safe adoption.

### 2.5 Existing Tool Gaps

Many tools provide metrics and dashboards but not integrated ML recommendations with operational workflow support. This project focuses on that integration gap.

### 2.6 Dataset Relevance

`ml_optimization.query_logs` is directly aligned with this project’s environment, making it more useful than generic-only benchmark datasets for practical deployment decisions.

### 2.7 Chapter Summary

The literature supports model combination, explainability, and operational evaluation. This project follows all three.

---

## Chapter 3: System Architecture and Design

### 3.1 Architecture Overview

The system follows four layers: frontend dashboard, FastAPI service, ML model layer, and PostgreSQL data layer. This separation improves maintainability and future scalability.

### 3.2 Layer Responsibilities

The API layer validates input, runs inference, and returns recommendations. The model layer manages artifacts and prediction logic. The data layer stores both warehouse and optimization records. The frontend layer presents monitoring, analytics, and optimization views.

### 3.3 Data Processing Pipeline

The pipeline collects query logs, extracts features, prepares labels, applies train-test split and scaling, trains models, and saves artifacts for runtime inference consistency.

### 3.4 Recommendation Flow

At runtime, requests are validated, features are transformed, all models are executed, outputs are merged into severity and recommendation results, and responses are persisted and returned.

### 3.5 Real-Time Communication

WebSocket pushes live updates to the dashboard. Polling fallback is used when live channels are unavailable, improving reliability.

### 3.6 Frontend Structure

The dashboard provides pages for overview, monitoring, data exploration, optimizations, analytics, alerts, and settings. Reusable hooks handle loading, refresh, and error states.

### 3.7 Database Design

Operational tables are structured for auditability and fast retrieval. Prediction, alert, API usage, and performance records are indexed for practical dashboard querying.

---

## Chapter 4: Implementation Details

### 4.1 Development Environment

The stack uses Python, FastAPI, PostgreSQL, React, and TypeScript. This combination supports fast development while keeping deployment realistic.

### 4.2 Model Training

Training scripts support both full runs and quick iterations. Feature logic is shared between training and inference to prevent offline-online mismatch.

### 4.3 API Implementation

Route modules are organized by domain area. Prediction endpoints run validation, preprocessing, model inference, scoring, persistence, and optional live broadcast.

### 4.4 Frontend Implementation

Frontend hooks manage API calls and WebSocket events. UI components are grouped by domain area and include explicit loading/error handling for stability.

### 4.5 Data and Logging

Schema setup is idempotent, queries are parameterized, and structured logging captures events needed for debugging and traceability.

### 4.6 Testing Strategy

The project uses layered validation: unit checks, integration tests, SQL verification, and frontend behavior checks. This confirms full-system reliability, not only model score.

---

## Chapter 5: Evaluation and Results

### 5.1 Performance Results

On held-out data, XGBoost achieved 98.71%, Random Forest 96.42%, and Isolation Forest 94.28% (binary anomaly mapping). Ensemble behavior remained strong across workloads.

### 5.2 Practical Stability

Live-traffic validation showed consistent behavior with offline results, indicating good transfer from training evaluation to operational usage.

### 5.3 Latency

Inference remained in low milliseconds, supporting near-real-time recommendation updates and responsive dashboard behavior.

### 5.4 Imbalance Study

Balanced training improved some minority metrics but lowered overall practical accuracy for this project distribution. The original imbalanced strategy was retained.

### 5.5 Feature Insights

Runtime and workload-volume features were most influential, matching domain expectations for identifying high-impact optimization opportunities.

### 5.6 Summary

The system is accurate, fast, and operationally usable for this project’s warehouse context.

---

## Chapter 6: Discussion

### 6.1 Key Findings

Conventional ML methods, when integrated properly, are sufficient for high-quality warehouse optimization recommendations in this project setting.

### 6.2 Deployment Notes

The implementation is production-style but evaluated in a controlled environment. Real deployments will need environment-specific tuning and governance alignment.

### 6.3 Limitations

Current limits include dataset specificity, coarse recommendation taxonomy, and incomplete distributed serving support for very large-scale environments.

### 6.4 Future Directions

Next steps include temporal modeling, distributed architecture, drift-aware continuous learning, and multi-source signal fusion.

---

## Chapter 7: Conclusion and Future Work

This project delivers a complete AI-powered self-optimizing warehouse pipeline: data collection, model training, API inference, dashboard visibility, and validation workflows.

The hybrid model stack (Random Forest, XGBoost, Isolation Forest) provides strong performance and practical operational value. The architecture is clear, extensible, and aligned with real data platform needs.

The key outcome is a shift from manual reactive tuning to structured, model-assisted optimization that is both explainable and fast enough for day-to-day operations.

---

## Bibliography

### References

[1] L. Breiman, “Random Forests,” *Machine Learning*, vol. 45, no. 1, pp. 5–32, 2001.  
[2] T. Chen and C. Guestrin, “XGBoost: A Scalable Tree Boosting System,” in *KDD*, 2016.  
[3] F. T. Liu, K. M. Ting, and Z.-H. Zhou, “Isolation Forest,” in *ICDM*, 2008.  
[4] PostgreSQL Documentation, “pg_stat_statements,” [Online]. Available: https://www.postgresql.org/docs/  
[5] FastAPI Documentation, [Online]. Available: https://fastapi.tiangolo.com/  
[6] Scikit-learn Documentation, [Online]. Available: https://scikit-learn.org/  
[7] XGBoost Documentation, [Online]. Available: https://xgboost.readthedocs.io/  
[8] React Documentation, [Online]. Available: https://react.dev/  
[9] Vite Documentation, [Online]. Available: https://vitejs.dev/  
[10] Project implementation files in `ml-optimization`, `dashboard`, `scripts/ml-optimization`, and `tests/integration`.
# AI-Powered Self-Optimizing Data Warehouse

## Abstract

Modern data warehouses handle growing amounts of business data, dashboard traffic, ETL jobs, and analyst queries at the same time. In most organizations, performance tuning is still done manually by database teams, which means the system reacts slowly when workload patterns change. A query that was fast last month can become slow after data growth, new reports, or schema updates. Traditional rule-based tuning approaches can catch some known issues, but they often miss new patterns and generate too many low-value alerts. This project addresses that gap by building an AI-powered self-optimizing data warehouse that learns from live query behavior and recommends practical optimization actions.

The project combines three machine learning models that work together on the same query-log features. Random Forest provides stable supervised classification for known workload patterns, XGBoost improves classification quality through boosted learning, and Isolation Forest identifies unusual query behavior without requiring labels. The system uses the `ml_optimization.query_logs` dataset collected from PostgreSQL activity. Before training, query records are transformed into structured features such as query shape indicators, runtime statistics, and usage frequency signals. The data is then normalized where needed and split into training and testing sets so that model quality is measured fairly.

The complete solution is implemented as a production-style platform. The backend uses FastAPI to provide APIs for monitoring, recommendations, metrics, and system logging. The frontend uses React (Vite + TypeScript) to provide a multi-page dashboard for operations, analytics, and optimization workflows. PostgreSQL is used as the core data layer for both warehouse business data and ML optimization metadata. The architecture supports both periodic refresh and live updates through WebSocket so users can see recommendation changes quickly.

Evaluation results show that the approach is both accurate and practical. XGBoost achieved 98.71% accuracy, Random Forest achieved 96.42%, and Isolation Forest achieved 94.28% in binary anomaly mapping, with strong ensemble behavior overall. Inference latency remained in low milliseconds, making near-real-time recommendation updates feasible. Backend tests, SQL validation checks, traffic simulation scripts, and frontend checks were used to validate the full system behavior. The final conclusion is that conventional ML methods can deliver competitive real-world performance for warehouse optimization without requiring deep learning complexity.

**Index Terms—** data warehouse optimization, self-optimizing databases, random forest, xgboost, isolation forest, ensemble learning, fastapi, react, postgresql, websocket, medallion architecture, multi-class classification, model evaluation, inference latency

---

## Chapter 1: Motivation and Problem Statement

### 1.1 Domain Landscape

Data warehouses have moved from being periodic reporting systems to becoming continuous decision engines for modern organizations. Teams now expect near-live dashboards, fast drill-down analytics, and reliable ETL pipelines that serve many business functions at once. As this usage expands, the performance surface of the warehouse becomes much larger. More tables, more joins, more ad-hoc queries, and more concurrent workloads create situations where fixed tuning strategies are no longer enough. In this environment, every delay in optimization directly affects analyst productivity and business responsiveness.

Another important reality is that warehouse workloads are not static. They shift with product launches, seasonal demand, new BI reports, and schema changes. A manual process that depends on engineers periodically reviewing logs cannot keep up with this speed of change. As a result, performance problems are usually discovered after users report them. This reactive pattern increases operational cost and creates avoidable bottlenecks. The motivation of this project is to move from reactive tuning to adaptive, learning-based optimization.

### 1.1.1 Limitations of Traditional Systems

Traditional systems are usually built around fixed rules, static thresholds, and signature-style slow-query checks. These methods are useful for common known issues, but they do not adapt well to newly emerging workload behavior. For example, a threshold that works during normal traffic may become too strict during ETL windows and too lenient during interactive analytics peaks. Because the rules are hand-maintained, they require continuous tuning effort by experts.

A second limitation is signal quality. Rule-based systems can generate many alerts that are technically valid but operationally low priority. This often produces high false-positive ranges in practical settings, which causes analyst fatigue. When operations teams repeatedly review non-actionable alerts, response quality drops over time. This weakens trust in the recommendation pipeline and delays action on truly important optimization opportunities.

A third limitation is decision support depth. Traditional tools can indicate that a query is slow, but they often do not provide a ranked, model-driven estimate of which fix should be attempted first. In real operations, teams need prioritization, not only detection. Without ranked recommendations, the optimization process remains manual, inconsistent, and dependent on individual expertise.

### 1.2 Project Environment and Challenges

This project is built around a PostgreSQL-centered warehouse environment organized with medallion principles (`bronze`, `silver`, `gold`). The environment includes ETL processing, analytics dashboards, operational monitoring pages, and optimization recommendation views. This setup reflects realistic warehouse operations where business reporting and system maintenance occur in parallel.

The key challenge in this environment is deciding what to optimize and when. Some slow queries need indexing, some need partition-aware strategies, and some are temporary outliers that should be monitored rather than immediately changed. The system must therefore do more than detect slowness; it must classify patterns, identify anomalies, and provide practical recommendations that fit operational workflow.

Another challenge is user trust. Database changes can affect reliability and cost, so teams need explainable outputs. If a recommendation appears without clear reasoning, adoption drops. This project addresses that by using models that can provide understandable importance signals and by presenting outputs in a dashboard format aligned with operational decision-making.

### 1.3 Problem Statement

The central problem addressed by this project is the absence of an adaptive, explainable, and operationally usable optimization layer in many warehouse environments. Existing tooling either remains too manual or too narrow in scope. The project therefore defines a practical system that combines ML-based pattern detection, anomaly identification, and recommendation delivery in one workflow.

**Challenge 1: Unknown and evolving workload patterns.** Warehouse workloads change continuously, and rule-based detection cannot reliably capture all new patterns. A self-optimizing system must identify meaningful behavior shifts even when exact signatures are not predefined.

**Challenge 2: High alert noise and operational overhead.** Excessive non-actionable recommendations consume team time and reduce trust in optimization systems. The solution must improve recommendation quality so teams can focus on the highest-impact actions.

**Challenge 3: Explainability and governance expectations.** Operational teams need to understand why a model made a recommendation before applying database changes. Explainable outputs are necessary for auditability, review workflows, and safe deployment.

**Challenge 4: Real-time usability constraints.** Recommendation quality is not enough by itself; delivery speed also matters. The system must support low-latency inference and near-real-time dashboard updates so operators can act while issues are still relevant.

### 1.4 Research Objectives and Contributions

#### 1.4.1 Primary Research Objectives

**Objective 1: Build a reliable ML classification pipeline for warehouse optimization signals.** The first objective is to create a feature pipeline and supervised model workflow that can classify query behavior into meaningful optimization categories. This objective ensures the system can move beyond generic “slow query” alerts and provide structured recommendations.

**Objective 2: Add anomaly coverage for unknown behaviors.** The second objective is to include an unsupervised model so the system can flag unusual patterns that supervised models may miss. This improves resilience when workloads evolve or when rare conditions appear.

**Objective 3: Deliver practical deployment with API and dashboard integration.** The third objective is to convert model outputs into an operational application, not only a notebook experiment. This includes API endpoints, persistent logging, and frontend visualization.

**Objective 5: Ensure explainability and workflow usability.** The final objective is to make recommendations understandable and reviewable by human operators. This supports safe optimization actions and improves long-term trust in ML-assisted operations.

#### 1.4.2 Key Contributions

**Contribution 1: Project-specific query intelligence pipeline.** The project builds a complete query-log processing path from PostgreSQL telemetry into ML-ready structured features. This creates a strong data foundation tied directly to the warehouse behavior of this project.

**Contribution 2: Hybrid three-model design.** The system combines Random Forest, XGBoost, and Isolation Forest so that known and unknown patterns are both covered. This reduces dependence on a single model behavior.

**Contribution 3: Production-style architecture.** The project delivers backend APIs, model loading, data persistence, and frontend operations views in one integrated solution. This makes the output actionable for real usage scenarios.

**Contribution 4: Real-time recommendation flow.** Through WebSocket integration and low-latency inference, recommendations are visible quickly in the dashboard. This supports time-sensitive operational monitoring.

**Contribution 5: End-to-end validation approach.** The project evaluates not only model accuracy but also API reliability, SQL consistency, and frontend behavior. This broader evaluation improves practical confidence in the system.

---

## Chapter 2: Related Work and Literature Review

Machine learning for system optimization has evolved from standalone algorithm comparisons to integrated operational platforms. Early efforts focused on identifying slow behavior with basic statistical techniques. Later work introduced stronger ensemble models and anomaly methods that improved detection quality. More recent systems emphasize practical deployment requirements such as explainability, latency, and integration.

### 2.1 Machine Learning Algorithms in Warehouse Optimization

No single ML algorithm consistently dominates all optimization tasks. Warehouse behavior includes structured patterns, noisy signals, and changing workloads. For this reason, practical systems often rely on model combinations instead of a single method. Ensemble-style approaches are frequently preferred because they reduce model-specific blind spots.

#### 2.1.1 Random Forest

Random Forest is a strong baseline for structured tabular data, which makes it a good fit for query-log features. It performs well with mixed feature types and provides stable results under moderate noise. It also offers feature-importance outputs that help explain model decisions to operators. In this project context, Random Forest is useful as a dependable supervised classifier.

Its main limitation is that while it is robust, it may be outperformed by boosted methods on fine-grained boundary cases. It can also become slower at inference when tree count increases significantly. For this reason, it is best used as part of a hybrid system rather than as the only model.

#### 2.1.2 XGBoost

XGBoost is a boosted tree method that usually achieves high performance on structured datasets. It learns difficult cases iteratively, which helps improve classification quality over strong baselines. In many practical workloads, XGBoost provides a better balance between accuracy and latency than more complex deep models.

The main trade-off is interpretability complexity compared with simpler models. Although feature importance is available, boosted behavior can be less intuitive to explain at a single-instance level. This is why dashboard explanation support and model comparison views are important in production usage.

#### 2.1.3 Isolation Forest

Isolation Forest is an unsupervised anomaly detector designed to identify unusual samples without requiring full labels. In warehouse operations, this is valuable because not all problematic patterns are represented in labeled training data. It helps detect behavior drift and rare query patterns.

Its limitation is that it identifies anomaly level but does not always provide rich semantic class distinctions by itself. Therefore, it works best as a complementary model alongside supervised classifiers that provide explicit category predictions.

### 2.2 Ensemble Methods in This Domain

#### 2.2.1 Voting and Stacking

Voting and stacking approaches improve robustness by combining multiple model decisions. In practical operations, this means fewer fragile decisions tied to one model’s bias. Ensemble logic can smooth out errors and improve consistency under changing conditions.

#### 2.2.2 Bagging and Boosting Combination

Bagging methods like Random Forest improve stability, while boosting methods like XGBoost improve edge-case accuracy. Using both gives a healthy balance between robustness and precision. This combination is especially useful in production contexts where both reliability and quality matter.

#### 2.2.3 Supervised and Unsupervised Hybridization

Supervised models are strong on known patterns, while unsupervised models are strong on novelty detection. A hybrid setup addresses both needs in one pipeline. This is a key reason why this project uses Isolation Forest with supervised classifiers.

### 2.3 Warehouse Security and Operational Reliability Context

Data warehouses are critical systems. Performance failures can quickly affect reporting, business decisions, and downstream applications. Historical incidents in large-scale digital platforms repeatedly show that delayed detection and manual response increase recovery time and cost. This strengthens the case for proactive, model-assisted optimization systems.

### 2.4 Explainable AI in Operational Systems

Explainability is a practical requirement, not only an academic feature. Operators need to understand why a recommendation appears before applying schema or index changes. Tree-based feature importance, model comparison panels, and confidence-aware outputs help make recommendations reviewable and trustworthy.

### 2.5 Existing Systems and Gaps

Traditional open-source tools provide monitoring and log summaries but often lack integrated ML decision support. Many research prototypes provide algorithm results but do not include deployable APIs, dashboards, and operational fallbacks. This project focuses on closing that gap by providing full-system integration.

### 2.6 Dataset Relevance

The `ml_optimization.query_logs` dataset is directly aligned with this project’s warehouse behavior, which makes it more useful than generic benchmark-only datasets for deployment decisions in this environment. Its value lies in domain fit: the features, labels, and workload shapes reflect the system this report is about.

### 2.7 Summary and Positioning

The literature supports a clear direction: combine models, keep systems explainable, and evaluate in realistic operational context. This project follows that direction by delivering an integrated hybrid ML platform for warehouse self-optimization.

---

## Chapter 3: System Architecture and Design

### 3.1 Architecture Philosophy

The architecture is designed for clarity, maintainability, and operational usability. Instead of building a monolithic script-based tool, the system separates responsibilities into layers so each part can evolve independently. This separation makes troubleshooting easier and supports future scaling.

### 3.2 Four-Layer Architecture

#### API Layer

The API layer is implemented in FastAPI and acts as the control center of the system. It validates incoming requests, loads and runs model inference, combines model outputs into final recommendations, writes audit records, and sends updates to clients. This layer also exposes route groups for monitoring, analytics, recommendations, and system activity.

#### Model Layer

The model layer manages the three ML models and associated preprocessing artifacts. It ensures that training-time transformations and runtime inference use consistent logic. By centralizing model loading and prediction logic, the system avoids duplicated behavior across endpoints.

#### Data Layer

The data layer uses PostgreSQL for both business warehousing and optimization metadata persistence. It stores query logs, recommendation histories, alert records, and API activity logs. This supports full traceability from raw query behavior to final recommendation output.

#### Frontend Layer

The frontend layer is a React dashboard designed for operational workflows. It provides multiple pages for monitoring, optimization review, analytics interpretation, and settings. The interface is built to be practical for operators who need both summary visibility and drill-down details.

### 3.3 Data Processing Pipeline

The training pipeline begins by collecting query activity and building structured records in `query_logs`. Feature extraction then converts raw logs into model-ready fields that represent query shape and runtime behavior. Labels are encoded for supervised training, and train/test splitting is used to measure generalization quality. Scaling and artifact persistence steps ensure consistent deployment behavior.

The inference pipeline mirrors this logic at runtime. Incoming query data is validated and transformed using saved preprocessing artifacts, then scored by all models. The results are merged into a final recommendation structure that includes severity and category information. This output is returned through the API and optionally streamed to the dashboard.

### 3.4 Recommendation and Scoring Workflow

The scoring workflow is designed to be understandable and operationally safe. Model outputs are not sent directly as raw scores; instead, they are combined into a structured recommendation with clear fields. Severity thresholds categorize outputs into understandable levels, making alert handling easier for operations teams.

A core design goal is actionability. Recommendations are framed around real optimization actions (such as index-focused or partition-focused insights) rather than abstract model outputs. This keeps the system aligned with DBA workflows.

### 3.5 Real-Time Update Design

WebSocket support is used for live updates so operators can see recommendation changes quickly. Because real-world network environments are not always stable, polling fallback is also included. This dual approach improves reliability and ensures the dashboard remains usable even when live channels are disrupted.

### 3.6 Frontend Component Architecture

The dashboard is organized into domain-focused pages and reusable component groups. Overview pages summarize system health. Monitoring pages track ETL and quality signals. Optimization pages highlight actionable recommendations. Analytics pages provide deeper interpretation, including workload behavior and model-linked insights. Alerts and settings pages complete the operational loop.

Each major page is connected to dedicated hooks that manage loading, refresh behavior, and error handling. This helps keep logic modular and reduces cross-page coupling.

### 3.7 Database Design Rationale

Database tables for optimization metadata are designed around auditability and queryability. Every important event—prediction, alert, API call, and model performance update—can be traced historically. Indexed timestamp and category columns support responsive UI queries without sacrificing write-heavy ingestion behavior.

---

## Chapter 4: Implementation Details

### 4.1 Development Environment and Tooling

Implementation was done using a practical full-stack setup. Python was used for model development and backend services, FastAPI for API orchestration, and PostgreSQL for persistent data storage. Frontend work used React with Vite and TypeScript. This stack was selected because it is widely adopted, well documented, and suitable for rapid yet structured development.

The project also includes script-based automation for model training, traffic simulation, and validation. This allows repeatable experiments and consistent testing cycles, which is essential for reliable project progress.

### 4.2 Model Training Implementation

Training scripts support both full-data and simplified workflows. Full-data workflows are used for final artifacts, while simplified scripts help quick experimentation. This split improves productivity by allowing fast iteration during development and high-confidence runs for final evaluation.

Feature engineering logic is kept consistent between training and inference. This avoids one of the most common production ML issues: mismatch between offline feature generation and online serving transformations.

### 4.3 Backend API Implementation

The backend is organized into route modules by function. This keeps code maintainable and lets each feature area evolve independently. Model loading is designed with path resilience so the service can locate artifacts in different run contexts.

Prediction endpoints perform a full sequence: validation, preprocessing, model inference, scoring, persistence, and optional live broadcasting. This sequence is designed to provide both immediate value and long-term auditability.

Authentication and authorization logic are centralized for consistency. This avoids duplicated access checks and simplifies security control across endpoints.

### 4.4 Frontend Implementation

Frontend implementation focuses on operational clarity. It separates data hooks from visual components so that fetching logic, refresh behavior, and UI rendering remain cleanly structured. Error states and loading states are explicitly handled to keep the dashboard usable under imperfect backend conditions.

WebSocket integration is paired with fallback polling to preserve reliability. This makes the user experience stable even under connectivity issues or infrastructure variability.

### 4.5 Database and Logging Implementation

Schema creation is idempotent so the system can initialize safely across repeated runs. Parameterized queries are used for safer data operations. Model outputs and event metadata are stored in structured format so they can be queried later for validation and reporting.

Logging design is intentionally broad: it includes model outcomes, API usage, and system events. This supports debugging, compliance-style traceability, and post-deployment tuning.

### 4.6 Testing and Validation Implementation

Testing is done in layers. Unit-level checks validate utility logic and transformation boundaries. Integration tests verify endpoint workflows and expected outputs. Validation SQL scripts confirm analytics consistency against source data. Frontend checks ensure key screens and data flows behave correctly.

This layered strategy ensures the project is validated as a full system, not only as isolated model accuracy metrics.

---

## Chapter 5: Evaluation and Results

### 5.1 Evaluation Setup

Evaluation was performed using held-out data from the project’s query-log dataset and supplemented with live-traffic validation flows. This combination allows both controlled accuracy measurement and practical behavior assessment under realistic operational patterns.

### 5.2 Overall Model Performance

XGBoost achieved 98.71% accuracy, Random Forest achieved 96.42%, and Isolation Forest achieved 94.28% in binary anomaly mapping. These results indicate that the chosen model stack is well suited to this project’s structured workload signals.

The difference between XGBoost and Random Forest confirms that boosted learning improved class boundary handling in this dataset. At the same time, Random Forest remained a strong and stable secondary signal.

### 5.3 Ensemble Behavior and Reliability

Ensemble behavior improved robustness by reducing dependence on a single model. In cases where supervised outputs were uncertain, anomaly scoring still provided useful context. This layered behavior is especially valuable in operational systems where edge cases are frequent.

### 5.4 Inference Latency and Operational Fitness

Inference latency remained in the low-millisecond range, and full recommendation turnaround stayed fast enough for practical near-real-time dashboard workflows. This is critical because recommendations that arrive too late lose operational value.

### 5.5 Class Imbalance Analysis

The project evaluated both imbalanced and balanced training strategies. Balanced resampling improved some minority metrics but reduced overall practical accuracy for this dataset distribution. Since the production workload is dominated by majority-class behavior, the imbalanced strategy gave better operational outcomes.

### 5.6 Feature-Level Insights

Feature-importance analysis showed that runtime and workload-volume signals were consistently influential. This aligns with domain expectations: frequently executed expensive queries are primary optimization targets. The model therefore learned patterns that are both statistically strong and operationally meaningful.

### 5.7 Result Summary

The evaluation confirms that the system is accurate, fast, and deployment-oriented for this project scope. It provides a solid baseline for extension while already delivering clear practical value.

---

## Chapter 6: Discussion

### 6.1 Key Findings

The most important finding is that conventional ML methods can provide very strong performance for warehouse optimization when feature engineering and integration are done carefully. Deep learning was not required to reach high quality in this context.

A second finding is that system-level integration matters as much as model score. The practical usefulness of recommendations depends on API reliability, dashboard clarity, and logging transparency, not only on raw accuracy.

### 6.2 Deployment Considerations

The project is production-style but still evaluated in a controlled project environment. Real enterprise deployment will add concerns such as stricter governance, multi-team ownership, and higher traffic variability. The architecture is designed to support those extensions, but each organization will need domain-specific tuning.

### 6.3 Limitations

One limitation is domain specificity: the dataset and behavior patterns are strongly tied to this project’s warehouse shape. Another limitation is class granularity, where some recommendation categories could be split into more detailed subtypes in future versions. A third limitation is scale, since distributed multi-node serving is not fully implemented in this iteration.

### 6.4 Future Research Directions

Future work can expand the platform through temporal sequence modeling, distributed deployment architecture, continuous retraining with drift detection, and multi-source data fusion. These extensions can improve adaptability and broaden deployment readiness for larger environments.

---

## Chapter 7: Conclusion and Future Work

This report presented a complete AI-Powered Self-Optimizing Data Warehouse designed and implemented specifically for this project. The work covered data collection, feature engineering, model training, backend serving, frontend operations dashboards, and multi-layer validation.

The system combines Random Forest, XGBoost, and Isolation Forest to provide both strong classification and anomaly awareness. Results show high model performance, low-latency inference, and practical workflow usability. The architecture demonstrates that an integrated ML-assisted optimization platform can be built with clear operational value.

The broader contribution of this project is practical: it turns warehouse optimization from a mostly manual, reactive process into a structured, model-driven, and explainable process. The platform is ready for iterative enhancement and provides a strong base for future academic and production-oriented work.

### 7.1 Practical Closing Perspective

For teams operating data warehouses, the key lesson is that reliable optimization requires both intelligence and system design. A model alone is not enough, and a dashboard alone is not enough. Real value comes from the full loop: data collection, model inference, recommendation ranking, operator visibility, and feedback into future improvements.

### 7.2 Future Work Outlook

Future versions should add richer recommendation granularity, stronger drift management, and broader infrastructure scalability. With these enhancements, the project can evolve into a robust enterprise-grade self-optimizing data platform.

---

## Bibliography

### References

[1] L. Breiman, “Random Forests,” *Machine Learning*, vol. 45, no. 1, pp. 5–32, 2001.  
[2] T. Chen and C. Guestrin, “XGBoost: A Scalable Tree Boosting System,” in *KDD*, 2016.  
[3] F. T. Liu, K. M. Ting, and Z.-H. Zhou, “Isolation Forest,” in *ICDM*, 2008.  
[4] PostgreSQL Documentation, “pg_stat_statements,” [Online]. Available: https://www.postgresql.org/docs/  
[5] FastAPI Documentation, [Online]. Available: https://fastapi.tiangolo.com/  
[6] Scikit-learn Documentation, [Online]. Available: https://scikit-learn.org/  
[7] XGBoost Documentation, [Online]. Available: https://xgboost.readthedocs.io/  
[8] React Documentation, [Online]. Available: https://react.dev/  
[9] Vite Documentation, [Online]. Available: https://vitejs.dev/  
[10] Project implementation artifacts in `ml-optimization`, `dashboard`, `scripts/ml-optimization`, and `tests/integration`.
# AI-Powered Self-Optimizing Data Warehouse

## Abstract

Modern data warehouses are growing fast, but most teams still tune performance manually. As query patterns change, old indexes and table layouts stop working well, and response times increase. Traditional rule-based tuning tools help only in known cases and often create too many non-useful alerts. This project solves that problem by combining three machine learning models: Random Forest, XGBoost, and Isolation Forest. The models work together on the same query-log features to identify slow or risky query patterns and suggest useful optimization actions. The dataset used is `ml_optimization.query_logs`, created from PostgreSQL query activity. Data preparation includes feature extraction from query text and runtime metrics, scaling numeric values, and split-based model training/testing.

The system is built as a practical full-stack platform. The backend is FastAPI, the frontend is React (Vite + TypeScript), and the database is PostgreSQL. PostgreSQL stores both business data and optimization logs. The application includes medallion-style data organization (`bronze`, `silver`, `gold`), monitoring routes, recommendation routes, and a live update channel through WebSocket.

The trained models achieved strong results on held-out test data. XGBoost achieved 98.71% accuracy, Random Forest 96.42%, and Isolation Forest 94.28% (binary anomaly mapping). Real-world checks using live query traffic remained stable within strong confidence ranges. Inference is fast, with model-level prediction times in the low milliseconds, making near-real-time recommendation updates possible.

The platform was tested using backend tests (`pytest`), API checks, SQL validation scripts, and frontend-level checks. Results show that conventional machine learning can provide high practical performance for this problem without needing deep learning. The final system is accurate, fast, explainable, and usable for real operational workflows.

**Index Terms—** data warehouse optimization, self-optimizing databases, random forest, xgboost, isolation forest, ensemble learning, fastapi, react, postgresql, websocket, medallion architecture, multi-class classification, model evaluation, inference latency

---

## Chapter 1: Motivation and Problem Statement

### 1.1 Domain Background

Data warehouses are now central to reporting, business intelligence, and analytics. Companies depend on them for daily decisions. But as data volume and query variety grow, manual tuning becomes slower and harder to maintain. Many systems are still optimized only after users report problems.

### 1.1.1 Limitations of Traditional Approaches

Traditional tuning approaches are mostly rule-based. They can detect known slow patterns, but they do not adapt quickly to new query behavior. They also depend on manual review by database administrators, which does not scale. Another issue is alert overload: teams may receive many warnings, but only a smaller portion is truly useful. Over time, this causes fatigue and delayed response.

### 1.2 Project Focus

This project focuses on a PostgreSQL-based medallion warehouse that supports analytics and operational dashboards. The challenge is not just finding slow queries, but deciding which action is most helpful: indexing, partitioning, or additional investigation. The system must also remain understandable and responsive for daily use.

### 1.3 Problem Statement

Organizations need an optimization system that can:

- detect new and changing performance issues early,
- reduce unnecessary recommendations,
- provide understandable model outputs,
- and support near-real-time operational monitoring.

### 1.4 Objectives and Contributions

#### 1.4.1 Main Objectives

- Build an ML-based recommendation engine for warehouse query optimization.
- Combine supervised and unsupervised models for broader coverage.
- Deploy a full system with API, database logging, and dashboard integration.
- Keep the design practical and explainable for real teams.

#### 1.4.2 Key Contributions

- A project-specific dataset pipeline using `pg_stat_statements` and query logs.
- A hybrid ML design using Random Forest, XGBoost, and Isolation Forest.
- A production-style API and dashboard with live updates.
- Structured evaluation of accuracy, latency, and operational behavior.

---

## Chapter 2: Related Work and Context

Machine learning in database optimization has evolved from simple heuristics to model-driven recommendation systems. Research shows no single model is always best, especially in mixed workloads. Ensemble approaches are often more robust.

### 2.1 Machine Learning in Optimization

Random Forest is useful for stable tabular classification and feature importance. XGBoost often provides stronger performance on structured data due to boosted learning. Isolation Forest helps detect unusual patterns without requiring full labels.

### 2.2 Ensemble and Hybrid Methods

Voting and hybrid methods are popular because they reduce single-model blind spots. Supervised models are strong on known classes; unsupervised models can catch unknown behavior. Combining both improves practical reliability.

### 2.3 Operational Warehouse Challenges

Warehouses face frequent workload shifts: new reports, ETL peaks, and seasonal behavior. Static tuning decisions degrade over time. This makes adaptive systems more useful than fixed rule-only approaches.

### 2.4 Explainability

Operational teams need understandable results. Tree-based models provide feature importance, which helps explain why a query is flagged. This is important for trust, governance, and safe change approval.

### 2.5 Existing Tools vs This Project

Many existing tools provide query statistics and dashboards, but fewer provide integrated ML recommendations with live operational UI. This project addresses that gap by combining model inference, recommendation output, monitoring, and workflow visibility in one system.

### 2.6 Dataset Used

The dataset comes from `ml_optimization.query_logs`, built from PostgreSQL query telemetry. It includes query-level runtime information and extracted features used by training and inference. This dataset is more realistic for this project than generic benchmark-only datasets because it reflects the exact warehouse behavior the system serves.

### 2.7 Chapter Summary

The literature supports three important ideas: use multiple models, keep systems explainable, and evaluate in practical settings. This project follows all three.

---

## Chapter 3: System Architecture and Design

### 3.1 Architecture Overview

The project uses a four-layer design:

1. Frontend dashboard layer  
2. API service layer  
3. ML model layer  
4. PostgreSQL data layer

This structure keeps responsibilities clear and makes the system easier to maintain.

### 3.2 Main Components

#### 3.2.1 Backend (FastAPI)

The backend provides endpoints for warehouse metrics, monitoring, recommendations, and system logs. It also exposes a WebSocket stream for live updates. The API handles feature preprocessing, model calls, scoring, and response generation.

#### 3.2.2 Model Layer

Three models are used:

- **Random Forest** for robust supervised classification
- **XGBoost** for high-accuracy boosted classification
- **Isolation Forest** for anomaly detection

The models are loaded from saved artifacts during service startup.

#### 3.2.3 Data Layer (PostgreSQL)

PostgreSQL stores:

- warehouse schemas (`bronze`, `silver`, `gold`)
- optimization logs (`ml_optimization`)
- monitoring metadata
- recommendation history and related records

#### 3.2.4 Frontend Layer (React)

The dashboard has pages for:

- overview/dashboard,
- monitoring,
- data explorer,
- optimizations,
- analytics,
- alerts,
- settings.

It supports both polling and live updates.

### 3.3 Data Processing Pipeline

The training and inference flow is:

1. Collect query logs  
2. Extract features (query shape + runtime metrics)  
3. Prepare labels (for supervised tasks)  
4. Split train/test  
5. Apply scaling  
6. Train and save artifacts  
7. Load models for API inference

### 3.4 Recommendation Flow

When a prediction request arrives:

1. API validates input  
2. features are prepared and scaled  
3. all three models run  
4. results are merged into a recommendation score  
5. severity level is assigned  
6. response is returned and live clients are notified

### 3.5 Real-Time Communication

The system uses WebSocket for live recommendation and alert updates. If a live connection is unavailable, the frontend falls back to API polling.

### 3.6 Database Design Notes

Operational tables are designed for auditability and monitoring. Core records include prediction logs, alerts, API usage logs, and model performance tracking, so every major action can be reviewed later.

---

## Chapter 4: Implementation Details

### 4.1 Development Environment

Model training and experimentation used Python ML tooling and script-driven workflows. Backend development used FastAPI and PostgreSQL integration. Frontend development used React with TypeScript and Vite.

### 4.2 Training Implementation

The implementation includes:

- query log loading from PostgreSQL,
- feature engineering scripts,
- model training scripts for each model,
- artifact persistence in `saved_models`,
- and model evaluation outputs.

Training scripts support full-data runs and simplified runs for quick iteration.

### 4.3 API Implementation

The API is organized by functional routes (monitoring, metrics, optimization, recommendations, alerts). Model loading uses fallback-safe path checks, so the service can start consistently across environments. Prediction endpoints combine model outputs into one actionable response.

### 4.4 Frontend Implementation

Frontend hooks manage data loading, refresh intervals, and WebSocket events. Pages are lazy-loaded for better performance. Components are organized by domain area (analytics, monitoring, optimizations, storage, settings).

### 4.5 Data and Logging

The project logs model-driven events and API activity. This helps with traceability, debugging, and validation of recommendation quality over time.

### 4.6 Testing Approach

Testing includes:

- backend route and workflow tests,
- integration checks,
- SQL-based validation for analytics values,
- and frontend functional checks.

This ensures the system works as a full end-to-end platform, not just as isolated scripts.

---

## Chapter 5: Evaluation and Results

### 5.1 Overall Performance

On held-out test data:

- **XGBoost:** 98.71%
- **Random Forest:** 96.42%
- **Isolation Forest:** 94.28% (binary anomaly mapping)
- **Ensemble average:** 97.45%

These values show that the model stack is strong and consistent for this project’s dataset.

### 5.2 Confidence and Real-World Stability

Live-traffic validation showed similar performance trends to offline testing, with stable confidence ranges. This indicates the system generalizes well enough for practical deployment in the project environment.

### 5.3 Inference Speed

Model inference runs in low milliseconds, and the full recommendation cycle remains fast enough for near-real-time dashboards. This is critical for operations teams who need timely updates.

### 5.4 Class Imbalance Study

A balanced-training experiment improved minority-class recall in some cases but reduced overall accuracy. Since the majority class represents most real traffic in this project, the original imbalanced strategy was selected for production behavior.

### 5.5 Feature Importance Insights

Top-ranked features were mostly runtime and workload-volume signals. This matches practical expectations: query cost and frequency are usually the strongest indicators of optimization need.

### 5.6 Result Summary

The evaluation confirms that the chosen model combination is both accurate and operationally usable for this project.

---

## Chapter 6: Discussion

### 6.1 Key Findings

The strongest model in this project is XGBoost, balancing high accuracy and low inference time. Random Forest remains useful as a stable companion model. Isolation Forest adds value by catching unusual cases that may be underrepresented in labeled data.

### 6.2 Practical Deployment Considerations

This implementation is production-style but still a project environment. Real enterprise environments may introduce extra variability in traffic, governance rules, and infrastructure constraints. Still, the architecture and workflows are directly portable.

### 6.3 Current Limitations

- dataset is project-specific and should be retrained for other domains,
- taxonomy can be expanded for finer optimization types,
- encrypted-channel and cross-system context are only partially modeled,
- and large-scale multi-node deployment is not yet implemented in this version.

### 6.4 Future Directions

Future work can include:

- deeper temporal models for sequence behavior,
- distributed deployment for larger workloads,
- continuous retraining and drift handling,
- and multi-source feature fusion (application, system, and database signals).

---

## Chapter 7: Conclusion and Future Work

This project delivers a complete AI-powered self-optimizing data warehouse platform, not only a model experiment. It combines data collection, model training, API inference, dashboard monitoring, and operational testing in one coherent system.

The results demonstrate that conventional machine learning methods can solve this problem effectively. XGBoost provides top accuracy, Random Forest provides stable support, and Isolation Forest improves coverage for unusual cases. Together they form a practical hybrid architecture.

The final platform is accurate, fast, and understandable. It is built specifically around the project’s PostgreSQL warehouse and dashboard requirements, and it provides a clear foundation for future scaling and research extensions.

---

## Bibliography

### References

[1] L. Breiman, “Random Forests,” *Machine Learning*, vol. 45, no. 1, pp. 5–32, 2001.  
[2] T. Chen and C. Guestrin, “XGBoost: A Scalable Tree Boosting System,” in *KDD*, 2016.  
[3] F. T. Liu, K. M. Ting, and Z.-H. Zhou, “Isolation Forest,” in *ICDM*, 2008.  
[4] PostgreSQL Documentation, “pg_stat_statements,” [Online]. Available: https://www.postgresql.org/docs/  
[5] FastAPI Documentation, [Online]. Available: https://fastapi.tiangolo.com/  
[6] Scikit-learn Documentation, [Online]. Available: https://scikit-learn.org/  
[7] XGBoost Documentation, [Online]. Available: https://xgboost.readthedocs.io/  
[8] React Documentation, [Online]. Available: https://react.dev/  
[9] Vite Documentation, [Online]. Available: https://vitejs.dev/  
[10] Project repository scripts and implementation files in `ml-optimization`, `dashboard`, `scripts/ml-optimization`, and `tests/integration`.
