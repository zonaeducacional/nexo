#[no_mangle]
pub extern "C" fn atividade_completa(respondidas: u32, total: u32) -> u32 {
    u32::from(total > 0 && respondidas == total)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exige_todas_as_respostas_de_uma_atividade_nao_vazia() {
        assert_eq!(atividade_completa(0, 0), 0);
        assert_eq!(atividade_completa(2, 3), 0);
        assert_eq!(atividade_completa(3, 3), 1);
        assert_eq!(atividade_completa(4, 3), 0);
    }
}
