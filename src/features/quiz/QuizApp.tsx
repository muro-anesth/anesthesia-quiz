"use client";
import { useQuizController } from "./useQuizController";
import { AdminPanel } from "./AdminPanel";
import { s } from "./theme";
import { HomeScreen } from "./screens/HomeScreen";
import { LoadingScreen } from "./screens/LoadingScreen";
import { EmptyScreen } from "./screens/EmptyScreen";
import { QuestionScreen } from "./screens/QuestionScreen";
import { SummaryScreen } from "./screens/SummaryScreen";
import { ExamSelectScreen } from "./screens/ExamSelectScreen";
import { ExamQuestionScreen } from "./screens/ExamQuestionScreen";
import { ExamTransitionScreen } from "./screens/ExamTransitionScreen";
import { ExamResultScreen } from "./screens/ExamResultScreen";
import { ExamHistoryScreen } from "./screens/ExamHistoryScreen";
import { ReviewScreen } from "./screens/ReviewScreen";
import { StatsScreen } from "./screens/StatsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { StarredScreen } from "./screens/StarredScreen";

export default function QuizApp() {
  const model = useQuizController();
  const star = {
    starred: model.questionStarred,
    loading: model.starLoading,
    busy: model.starSaving,
    error: model.starError,
    onToggle: () => { if (model.question) void model.toggleStar(model.question.id); },
    onRetry: model.reloadStars,
  };
  if (!model.mounted || model.authLoading) return null;
  return (
    <div
      style={{
        minHeight: "100vh",
        background: s.bg,
        color: s.text,
        fontFamily: "'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif",
        maxWidth: 430,
        margin: "0 auto",
      }}
    >
      {model.showAdmin && (
        <AdminPanel onClose={() => model.setShowAdmin(false)} />
      )}
      <HomeScreen
        startDailyQuiz={model.startDailyQuiz}
        dailySession={model.dailySession}
        dailyError={model.dailyError}
        handleShowExamHistory={model.handleShowExamHistory}
        handleShowStats={model.handleShowStats}
        phase={model.phase}
        setPhase={model.setPhase}
        setShowAdmin={model.setShowAdmin}
        startQuiz={model.startQuiz}
        startReview={model.startReview}
        showStarred={model.showStarred}
        userProfile={model.userProfile}
      />
      <LoadingScreen phase={model.phase} />
      <EmptyScreen
        phase={model.phase}
        saving={model.saving}
        setPhase={model.setPhase}
      />
      <QuestionScreen
        dailySession={model.dailySession}
        dailyActive={model.dailyActive}
        cycleComplete={model.cycleComplete}
        handleAnswer={model.handleAnswer}
        handleContinue={model.handleContinue}
        star={star}
        isCorrect={model.isCorrect}
        phase={model.phase}
        question={model.question}
        saveError={model.saveError}
        saving={model.saving}
        selected={model.selected}
        setPhase={model.setPhase}
        setShowExplanation={model.setShowExplanation}
        showExplanation={model.showExplanation}
      />
      <SummaryScreen phase={model.phase} setPhase={model.setPhase} dailySession={model.dailySession} dailyActive={model.dailyActive} startDailyQuiz={model.startDailyQuiz} saving={model.saving} />
      <ExamSelectScreen
        phase={model.phase}
        saving={model.saving}
        setPhase={model.setPhase}
        startExam={model.startExam}
        years={model.years}
      />
      <ExamQuestionScreen
        star={star}
        examBaseYear={model.examBaseYear}
        examIndex={model.examIndex}
        examPart={model.examPart}
        examQuestions={model.examQuestions}
        handleExamAnswer={model.handleExamAnswer}
        isCorrect={model.isCorrect}
        nextExamQuestion={model.nextExamQuestion}
        phase={model.phase}
        question={model.question}
        selected={model.selected}
        setPhase={model.setPhase}
        setShowExamWarning={model.setShowExamWarning}
        showExamWarning={model.showExamWarning}
        showExplanation={model.showExplanation}
        setShowExplanation={model.setShowExplanation}
      />
      <ExamTransitionScreen
        examAnswers={model.examAnswers}
        examPartACount={model.examPartACount}
        phase={model.phase}
        startPartB={model.startPartB}
      />
      <ExamResultScreen
        examResult={model.examResult}
        handleShowExamHistory={model.handleShowExamHistory}
        phase={model.phase}
        setPhase={model.setPhase}
      />
      <ExamHistoryScreen
        examHistory={model.examHistory}
        phase={model.phase}
        saving={model.saving}
        setPhase={model.setPhase}
        years={model.years}
      />
      <ReviewScreen
        beginReview={model.beginReview}
        phase={model.phase}
        reviewQueue={model.reviewQueue}
        saving={model.saving}
        setPhase={model.setPhase}
      />
      <StarredScreen {...model} />
      <StatsScreen
        phase={model.phase}
        saving={model.saving}
        setPhase={model.setPhase}
        stats={model.stats}
      />
      <SettingsScreen
        bgmEnabled={model.bgmEnabled}
        bgmTrack={model.bgmTrack}
        categories={model.categories}
        phase={model.phase}
        saving={model.saving}
        selectedCats={model.selectedCats}
        selectedYears={model.selectedYears}
        setBgmEnabled={model.setBgmEnabled}
        setBgmTrack={model.setBgmTrack}
        setPhase={model.setPhase}
        setSelectedCats={model.setSelectedCats}
        setSelectedYears={model.setSelectedYears}
        years={model.years}
      />
    </div>
  );
}
