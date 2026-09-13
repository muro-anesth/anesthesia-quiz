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

export default function QuizApp() {
  const model = useQuizController();
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
        handleShowExamHistory={model.handleShowExamHistory}
        handleShowStats={model.handleShowStats}
        phase={model.phase}
        setPhase={model.setPhase}
        setShowAdmin={model.setShowAdmin}
        startQuiz={model.startQuiz}
        startReview={model.startReview}
        userProfile={model.userProfile}
      />
      <LoadingScreen phase={model.phase} />
      <EmptyScreen
        phase={model.phase}
        saving={model.saving}
        setPhase={model.setPhase}
      />
      <QuestionScreen
        cycleComplete={model.cycleComplete}
        finishAfterRating={model.finishAfterRating}
        handleAnswer={model.handleAnswer}
        handleRating={model.handleRating}
        isCorrect={model.isCorrect}
        phase={model.phase}
        question={model.question}
        saveError={model.saveError}
        saving={model.saving}
        selected={model.selected}
        setFinishAfterRating={model.setFinishAfterRating}
        setPhase={model.setPhase}
        setShowExplanation={model.setShowExplanation}
        showExplanation={model.showExplanation}
      />
      <SummaryScreen phase={model.phase} setPhase={model.setPhase} />
      <ExamSelectScreen
        phase={model.phase}
        saving={model.saving}
        setPhase={model.setPhase}
        startExam={model.startExam}
        years={model.years}
      />
      <ExamQuestionScreen
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
