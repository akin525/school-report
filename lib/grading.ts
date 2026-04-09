export function calculateGrade(score: number, maxScore: number = 100, gradingSystem: any[]): { grade: string; remark: string; color: string } {
  const pct = (score / maxScore) * 100;
  
  if (!gradingSystem || gradingSystem.length === 0) {
    // Fallback to defaults if no system provided
    const grade = getGrade(score, maxScore);
    return { 
      grade, 
      remark: getGradeLabel(grade),
      color: grade === 'F' ? '#991b1b' : '#15803d'
    };
  }

  // Sort grading system by min_score descending to find the highest match
  const sorted = [...gradingSystem].sort((a, b) => b.min_score - a.min_score);
  
  for (const g of sorted) {
    if (pct >= g.min_score) {
      return { grade: g.grade, remark: g.remark || '', color: g.color || '#000000' };
    }
  }

  // Final fallback if nothing matches (should not happen if system is complete)
  return { grade: 'F', remark: 'Fail', color: '#991b1b' };
}

export function getGrade(score: number, maxScore: number = 100): string {
  const pct = (score / maxScore) * 100;
  if (pct >= 95) return 'A+';
  if (pct >= 90) return 'A';
  if (pct >= 87) return 'B+';
  if (pct >= 83) return 'B';
  if (pct >= 80) return 'B-';
  if (pct >= 77) return 'C+';
  if (pct >= 73) return 'C';
  if (pct >= 70) return 'C-';
  if (pct >= 67) return 'D+';
  if (pct >= 63) return 'D';
  if (pct >= 60) return 'D-';
  return 'F';
}

export function getGradeLabel(grade: string): string {
  const labels: Record<string, string> = {
    'A+': 'Distinction',
    'A': 'Super Performance',
    'B+': 'Very High',
    'B': 'High',
    'B-': 'Good',
    'C+': 'High Credit',
    'C': 'Credit',
    'C-': 'Average',
    'D+': 'Good Pass',
    'D': 'Very Good Pass',
    'D-': 'Good Pass',
    'F': 'Fail',
  };
  return labels[grade] || '';
}

export function getGradeColor(grade: string, gradingSystem: any[]): string {
  if (!gradingSystem || gradingSystem.length === 0) {
    return grade === 'F' ? '#991b1b' : '#15803d';
  }
  const match = gradingSystem.find(g => g.grade === grade);
  return match?.color || '#000000';
}
