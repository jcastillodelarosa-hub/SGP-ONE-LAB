"""Explicit fixture inserts for 19 supplied programming columns, no fake triggers."""
import re

def adapt_program_inserts(text):
    pattern=r"INSERT INTO (?:public\.)?sgp_mecanizado_programacion VALUES\(([^;]+)\);?"
    def replacement(match):
        return "INSERT INTO sgp_mecanizado_programacion(id_programacion,reserva,sistema,acabado,cantidad_programada,fecha_programacion,turno,prioridad,estado,usuario_programa,fecha_creacion,fecha_actualizacion,programada,prioridad_semanal) VALUES("+match[1]+",1,DATE '2026-10-25','TURNO 1',1,'PROGRAMADA','QA',now(),now(),true,'1');"
    return re.sub(pattern,replacement,text)
