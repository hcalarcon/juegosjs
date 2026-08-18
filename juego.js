/* =========================
   TEMPORIZADOR DEL FONDO
========================= */

let tiempoInactivo;


/* =========================
   VARIABLES DEL JUEGO
========================= */

let monedas = 0;

let monedasPorClick = 1;

let monedasPorSegundo = 0;

let costoCursor = 10;

let costoAuto = 50;

let nivel = 1;

let experiencia = 0;

let experienciaNecesaria = 100;


/* =========================
   ELEMENTOS DEL HTML
========================= */

const monedasTexto =
    document.getElementById("monedas");

const porClickTexto =
    document.getElementById("porClick");

const porSegundoTexto =
    document.getElementById("porSegundo");

const costoCursorTexto =
    document.getElementById("costoCursor");

const costoAutoTexto =
    document.getElementById("costoAuto");

const boton =
    document.getElementById("botonClick");

const fondo =
    document.getElementById("fondo");


/* =========================
   RUTAS DE LOS FONDOS
========================= */

const fondoActivo = "./tel_aviv_impressed.webp";

const fondoInactivo = "./TelAvivDepressed.jpg";


/* =========================
   COMPRAR CURSOR
========================= */

function comprarCursor() {

    if (monedas >= costoCursor) {

        monedas -= costoCursor;

        monedasPorClick++;

        costoCursor =
            Math.floor(costoCursor * 1.5);

        actualizar();

    }

}


/* =========================
   COMPRAR AUTOCLICKER
========================= */

function comprarAuto() {

    if (monedas >= costoAuto) {

        monedas -= costoAuto;

        monedasPorSegundo++;

        costoAuto =
            Math.floor(costoAuto * 1.8);

        actualizar();

    }

}


/* =========================
   MONEDAS AUTOMÁTICAS
========================= */

setInterval(() => {

    monedas += monedasPorSegundo;

    actualizar();

}, 1000);


/* =========================
   CLICK PRINCIPAL
========================= */

boton.addEventListener("click", () => {

    monedas += monedasPorClick;

    experiencia++;

    revisarNivel();

    actualizar();

    reiniciarTemporizador();

});


/* =========================
   SUBIR DE NIVEL
========================= */

function revisarNivel() {

    if (experiencia >= experienciaNecesaria) {

        experiencia = 0;

        nivel++;

        monedas += 200;

        experienciaNecesaria =
            Math.floor(experienciaNecesaria * 1.4);

    }

}


/* =========================
   ACTUALIZAR INTERFAZ
========================= */

function actualizar() {

    monedasTexto.textContent =
        Math.floor(monedas);

    porClickTexto.textContent =
        monedasPorClick;

    porSegundoTexto.textContent =
        monedasPorSegundo;

    costoCursorTexto.textContent =
        costoCursor;

    costoAutoTexto.textContent =
        costoAuto;

    document.getElementById("nivel").textContent =
        nivel;

    document.getElementById("xpActual").textContent =
        experiencia;

    document.getElementById("xpNecesaria").textContent =
        experienciaNecesaria;


    /* BARRA DE EXPERIENCIA */

    const porcentajeXP =
        (experiencia / experienciaNecesaria) * 100;

    document.getElementById("xp").style.width =
        porcentajeXP + "%";

}


/* =========================
   TEMPORIZADOR DEL FONDO
========================= */

function reiniciarTemporizador() {

    /* Cancelamos el temporizador anterior */

    clearTimeout(tiempoInactivo);


    /* Volvemos al fondo activo */

    fondo.style.backgroundImage =
        `url("${fondoActivo}")`;

    fondo.style.opacity = "0.9";


    /* Esperamos 10 segundos */

    tiempoInactivo = setTimeout(() => {


        /* Desaparece suavemente */

        fondo.style.opacity = "0";


        /*
            Esperamos lo mismo que dura
            la transición del CSS
        */

        setTimeout(() => {


            /* Cambiamos el fondo */

            fondo.style.backgroundImage =
                `url("${fondoInactivo}")`;


            /* Volvemos a mostrarlo */

            fondo.style.opacity = "0.9";


        }, 800);


    }, 10000);

}


/* =========================
   INICIAR JUEGO
========================= */

actualizar();

reiniciarTemporizador();