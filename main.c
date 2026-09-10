#include <stdio.h>
#include <stdlib.h>
#include <locale.h>
#include <string.h>

char nomes[50][50];
float precos[50];
int total = 0;

// LOGIN 
int login() {
    char user[20], senha[20];

    printf("Usuario: ");
    scanf("%s", user);

    printf("Senha: ");
    scanf("%s", senha);

    if (strcmp(user, "farmcz") == 0 && strcmp(senha, "442266") == 0) {
        return 1;
    }

    return 0;
}

// CADASTRAR 
void cadastrar() {
    printf("\nNome do produto: ");
    scanf("%s", nomes[total]);

    printf("Preco: ");
    scanf("%f", &precos[total]);

    total++;

    printf("PRODUTO CADASTRADO!\n");
}

// LISTAR 
void listar() {
    if (total == 0) {
        printf("\nNENHUM PRODUTO CADASTRADO\n");
        return;
    }

    printf("\nPRODUTOS CADASTRADOS\n");

    for (int i = 0; i < total; i++) {
        printf("%d - %s | R$ %.2f\n", i + 1, nomes[i], precos[i]);
    }

    printf("\n");
}

// MAIN E MENU 
int main() {
    setlocale(LC_ALL, "Portuguese");
    int opcao;

    printf("----- LOGIN -----\n");

    if (!login()) {
        printf("Login incorreto!\n");
        return 0;
    }

    do {
        printf("1 - Cadastrar\n");
        printf("2 - Listar\n");
        printf("3 - Sair\n");
        printf("Opcao: ");
        scanf("%d", &opcao);

        if (opcao == 1) {
            cadastrar();
        } 
        else if (opcao == 2) {
            listar();
        }

    } while (opcao != 3);

    printf("Saindo\n");
    return 0;
}
