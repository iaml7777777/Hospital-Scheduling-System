import { Injectable } from '@angular/core';
import { Unit, Shift, Nurse, Schedule, ScheduleCell } from '../models/schedule.models';

@Injectable({
  providedIn: 'root',
})
export class ExportService {
  /**
   * Exports the monthly schedule as a CSV file with UTF-8 BOM for Microsoft Excel compatibility
   */
  exportScheduleToCsv(
    unit: Unit,
    schedule: Schedule,
    cells: ScheduleCell[],
    nurses: Nurse[],
    shifts: Shift[],
    daysInMonth: number
  ): void {
    const shiftMap = new Map(shifts.map((s) => [s.shift_id, s]));
    const headers = [
      '員工編號',
      '姓名',
      '層級',
      '可帶班',
      ...Array.from({ length: daysInMonth }, (_, i) => `${i + 1}日`),
      '上班天數',
      '休假天數',
      '夜班天數',
      '總工時',
      '最長連上',
    ];

    const rows: string[][] = [];

    // Filter nurses belonging to this unit
    const unitNurses = nurses.filter((n) => n.unit_id === unit.unit_id && n.is_active);

    for (const nurse of unitNurses) {
      const nurseCells = cells.filter((c) => c.nurse_id === nurse.nurse_id);
      let workDays = 0;
      let offDays = 0;
      let nightShifts = 0;
      let totalHours = 0;
      let consecutive = 0;
      let maxConsecutive = 0;

      const dayCols: string[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const m = String(schedule.month).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        const dateStr = `${schedule.year}-${m}-${d}`;
        const cell = nurseCells.find((c) => c.work_date === dateStr);

        if (cell?.shift_id) {
          const shift = shiftMap.get(cell.shift_id);
          const shiftCode = shift ? shift.code : '班';
          dayCols.push(cell.is_pinned ? `${shiftCode}*` : shiftCode);
          workDays++;
          totalHours += shift ? shift.work_hours : 8;
          consecutive++;
          if (consecutive > maxConsecutive) maxConsecutive = consecutive;
          if (shift?.is_night) nightShifts++;
        } else {
          const offLabel = cell?.off_type ? `休(${cell.off_type})` : '休';
          dayCols.push(offLabel);
          offDays++;
          consecutive = 0;
        }
      }

      rows.push([
        nurse.emp_no,
        nurse.name,
        nurse.level,
        nurse.can_lead ? '是' : '否',
        ...dayCols,
        String(workDays),
        String(offDays),
        String(nightShifts),
        String(totalHours),
        String(maxConsecutive),
      ]);
    }

    // Build CSV content
    const csvRows = [headers.map(this.escapeCsvCell).join(',')];
    for (const row of rows) {
      csvRows.push(row.map(this.escapeCsvCell).join(','));
    }

    // Prepend UTF-8 BOM (\uFEFF)
    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `${unit.code}_${schedule.year}年${schedule.month}月_護理班表.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private escapeCsvCell(cell: string): string {
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n') || cell.includes('\r')) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  }
}
