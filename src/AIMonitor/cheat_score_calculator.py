"""
Snoop Cheat Score Calculator
============================
Calculates comprehensive cheat scores combining:
1. Behavioral violations (tab switching, fullscreen exits, key presses)
2. AI anomalies (object detection, gaze tracking, face detection)

Score Range: 0-100
- 0-20: Low Risk (Minimal anomalies)
- 21-40: Moderate Risk
- 41-60: Medium Risk
- 61-80: High Risk
- 81-100: Very High Risk (Severe cheating indicators)
"""

import json
from typing import Dict, List, Any


class CheatScoreCalculator:
    """Calculate comprehensive cheat score for a student's test."""
    
    # Behavioral violation weights
    BEHAVIORAL_WEIGHTS = {
        'tab_switch': 8,
        'fullscreen_exit': 15,
        'mouse_leave': 5,
        'prohibited_key': 6,
        'window_blur': 5,
    }
    
    # AI anomaly weights
    ANOMALY_WEIGHTS = {
        'suspicious_object_detected': 10,
        'phone_detected': 20,
        'book_detected': 8,
        'laptop_detected': 12,
        'no_face_detected': 15,
        'multiple_persons_detected': 18,
        'gaze_away_from_screen': 8,
        'gaze_looking_left': 5,
        'gaze_looking_right': 5,
        'gaze_down': 3,
    }
    
    def __init__(self):
        self.behavioral_score = 0
        self.anomaly_score = 0
        self.combined_score = 0
        self.risk_level = "LOW"
        self.details = {}
    
    @staticmethod
    def calculate_behavioral_score(violations: Dict[str, List]) -> Dict[str, Any]:
        """
        Calculate score from behavioral violations.
        
        Args:
            violations: {
                'tab_switches': [...],
                'fullscreen_exits': [...],
                'action_logs': [...]
            }
        """
        score = 0
        breakdown = {}
        
        tab_switches = violations.get('tab_switches', [])
        if isinstance(tab_switches, list):
            count = len(tab_switches)
            score += count * CheatScoreCalculator.BEHAVIORAL_WEIGHTS['tab_switch']
            breakdown['tab_switches'] = {'count': count, 'score': count * CheatScoreCalculator.BEHAVIORAL_WEIGHTS['tab_switch']}
        
        fullscreen_exits = violations.get('fullscreen_exits', [])
        if isinstance(fullscreen_exits, list):
            count = len(fullscreen_exits)
            score += count * CheatScoreCalculator.BEHAVIORAL_WEIGHTS['fullscreen_exit']
            breakdown['fullscreen_exits'] = {'count': count, 'score': count * CheatScoreCalculator.BEHAVIORAL_WEIGHTS['fullscreen_exit']}
        
        action_logs = violations.get('action_logs', [])
        if isinstance(action_logs, list):
            count = len(action_logs)
            score += count * CheatScoreCalculator.BEHAVIORAL_WEIGHTS['prohibited_key']
            breakdown['action_logs'] = {'count': count, 'score': count * CheatScoreCalculator.BEHAVIORAL_WEIGHTS['prohibited_key']}
        
        return {
            'score': min(score, 50),  # Cap behavioral at 50
            'breakdown': breakdown,
            'total_violations': len(tab_switches) + len(fullscreen_exits) + len(action_logs)
        }
    
    @staticmethod
    def calculate_anomaly_score(anomalies: List[Dict]) -> Dict[str, Any]:
        """
        Calculate score from AI anomalies.
        
        Args:
            anomalies: List of anomaly dictionaries with 'type' and optionally 'confidence'
        """
        score = 0
        breakdown = {}
        
        if not anomalies:
            return {'score': 0, 'breakdown': {}, 'total_anomalies': 0}
        
        # Count anomalies by type
        anomaly_counts = {}
        for anomaly in anomalies:
            atype = anomaly.get('type', 'unknown')
            confidence = anomaly.get('confidence', 1.0)
            
            if atype not in anomaly_counts:
                anomaly_counts[atype] = {'count': 0, 'total_confidence': 0}
            
            anomaly_counts[atype]['count'] += 1
            anomaly_counts[atype]['total_confidence'] += confidence
        
        # Calculate score with confidence weighting
        for atype, data in anomaly_counts.items():
            count = data['count']
            avg_confidence = data['total_confidence'] / count if count > 0 else 0.5
            
            weight = CheatScoreCalculator.ANOMALY_WEIGHTS.get(atype, 5)
            anomaly_score = weight * count * avg_confidence
            score += anomaly_score
            
            breakdown[atype] = {
                'count': count,
                'avg_confidence': round(avg_confidence, 3),
                'score': round(anomaly_score, 2)
            }
        
        return {
            'score': min(score, 50),  # Cap anomalies at 50
            'breakdown': breakdown,
            'total_anomalies': len(anomalies)
        }
    
    @staticmethod
    def calculate_combined_score(
        behavioral_violations: Dict,
        ai_anomalies: List[Dict],
        integrity_score: int = 100
    ) -> Dict[str, Any]:
        """
        Calculate final combined cheat score.
        
        Args:
            behavioral_violations: Behavioral violation data from test
            ai_anomalies: List of AI-detected anomalies
            integrity_score: Original integrity score (0-100)
        
        Returns:
            {
                'cheat_score': 0-100,
                'integrity_score': 0-100,
                'final_score': 0-100 (lower is better),
                'risk_level': 'LOW'|'MODERATE'|'MEDIUM'|'HIGH'|'CRITICAL',
                'breakdown': {
                    'behavioral': {...},
                    'anomalies': {...}
                },
                'summary': 'Text summary...'
            }
        """
        # Calculate component scores
        behavioral = CheatScoreCalculator.calculate_behavioral_score(behavioral_violations)
        anomaly = CheatScoreCalculator.calculate_anomaly_score(ai_anomalies)
        
        # Combine scores (out of 100 total)
        # Behavior contributes 50%, Anomalies contribute 50%
        composite_cheat_score = (behavioral['score'] * 0.5) + (anomaly['score'] * 0.5)
        composite_cheat_score = min(composite_cheat_score, 100)
        
        # Final score: Average of integrity and cheat scores (inverted for cheat)
        # Integrity is already 0-100 where 0 is bad, 100 is good
        # Cheat score is 0-100 where 0 is good, 100 is bad
        # Convert integrity to "cheat" scale: 100 - integrity_score
        cheat_from_integrity = 100 - integrity_score
        
        # Weighted average: 60% from AI cheat, 40% from behavioral metrics
        final_cheat_score = (composite_cheat_score * 0.6) + (cheat_from_integrity * 0.4)
        final_cheat_score = min(max(final_cheat_score, 0), 100)
        
        # Determine risk level
        if final_cheat_score < 20:
            risk_level = "LOW"
        elif final_cheat_score < 40:
            risk_level = "MODERATE"
        elif final_cheat_score < 60:
            risk_level = "MEDIUM"
        elif final_cheat_score < 80:
            risk_level = "HIGH"
        else:
            risk_level = "CRITICAL"
        
        # Generate summary
        anomaly_desc = f"{anomaly['total_anomalies']} anomalies detected" if anomaly['total_anomalies'] > 0 else "No anomalies detected"
        behavior_desc = f"{behavioral['total_violations']} behavioral violations" if behavioral['total_violations'] > 0 else "No behavioral violations"
        
        summary = f"Risk Level: {risk_level} | {anomaly_desc} | {behavior_desc}"
        
        return {
            'cheat_score': round(final_cheat_score, 2),
            'integrity_score': integrity_score,
            'risk_level': risk_level,
            'breakdown': {
                'behavioral': behavioral,
                'anomalies': anomaly,
                'composite_cheat': round(composite_cheat_score, 2),
                'cheat_from_integrity': round(cheat_from_integrity, 2)
            },
            'summary': summary,
            'raw_scores': {
                'behavioral_score': behavioral['score'],
                'anomaly_score': anomaly['score'],
                'integrity_score': integrity_score
            }
        }


def parse_violations_from_form(form_data: Dict) -> Dict:
    """Parse violation data from form submission."""
    violations = {
        'tab_switches': [],
        'fullscreen_exits': [],
        'action_logs': []
    }
    
    try:
        if 'tabSwitchData' in form_data:
            tab_data = form_data['tabSwitchData']
            if isinstance(tab_data, str):
                violations['tab_switches'] = json.loads(tab_data)
            else:
                violations['tab_switches'] = tab_data
        
        if 'fullscreenData' in form_data:
            fs_data = form_data['fullscreenData']
            if isinstance(fs_data, str):
                violations['fullscreen_exits'] = json.loads(fs_data)
            else:
                violations['fullscreen_exits'] = fs_data
        
        if 'actionLogs' in form_data:
            action_data = form_data['actionLogs']
            if isinstance(action_data, str):
                violations['action_logs'] = json.loads(action_data)
            else:
                violations['action_logs'] = action_data
    except json.JSONDecodeError as e:
        print(f"Error parsing violation data: {e}")
    
    return violations


def parse_anomalies_from_form(form_data: Dict) -> List[Dict]:
    """Parse anomaly data from form submission."""
    anomalies = []
    
    try:
        if 'anomalyData' in form_data:
            anomaly_data = form_data['anomalyData']
            if isinstance(anomaly_data, str):
                anomalies = json.loads(anomaly_data)
            else:
                anomalies = anomaly_data
    except (json.JSONDecodeError, TypeError) as e:
        print(f"Error parsing anomaly data: {e}")
    
    return anomalies


if __name__ == "__main__":
    # Example usage
    test_violations = {
        'tab_switches': [
            {'duration': 5.2},
            {'duration': 3.1}
        ],
        'fullscreen_exits': [
            {'duration': 2.0}
        ],
        'action_logs': [
            {'type': 'PROHIBITED_KEY'},
            {'type': 'PROHIBITED_KEY'}
        ]
    }
    
    test_anomalies = [
        {'type': 'phone_detected', 'confidence': 0.95},
        {'type': 'gaze_away_from_screen', 'confidence': 0.87},
        {'type': 'no_face_detected', 'confidence': 1.0}
    ]
    
    result = CheatScoreCalculator.calculate_combined_score(
        test_violations,
        test_anomalies,
        integrity_score=75
    )
    
    print("Cheat Score Report:")
    print(json.dumps(result, indent=2))
