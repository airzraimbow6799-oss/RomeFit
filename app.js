document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // 3D AVATAR IMPLEMENTATION (THREE.JS)
    // ============================================================
    // Un solo GLB (cuerpo + polo modelados juntos en Blender) con morph targets
    // horneados. El polo se esculpió SOBRE el cuerpo (shrinkwrap) y sus morphs
    // tienen amplitud mayor a la del cuerpo, por lo que nunca se traspasan.
    // Morphs cuerpo:  ancho, altura, hombros, abdomen, caidos
    // Morphs polo:    los mismos + holgura, largo (solo prenda)
    class Mannequin3D {
        constructor(scene, isModal = false) {
            this.group = new THREE.Group();
            // Modelo mide 1.75 unidades (metros). Escalamos a ~6.5 de alto en escena.
            const s = 6.5 / 1.75;
            this.group.scale.set(s, s, s);
            this.group.position.y = -3.1; // pies cerca del borde inferior
            scene.add(this.group);

            this.isModal = isModal;
            this.bodyMesh = null;
            this.shirtMesh = null;
            // Influencias objetivo por morph (se interpolan suavemente cada frame)
            this.targets = { ancho: 0, altura: 0, hombros: 0, abdomen: 0, caidos: 0, holgura: 0, largo: 0 };

            if (window.THREE && window.THREE.GLTFLoader) {
                const loader = new THREE.GLTFLoader();
                loader.load('Cuerpo 3d/avatar_fit.glb', (gltf) => {
                    gltf.scene.traverse((child) => {
                        if (child.isMesh && child.morphTargetDictionary) {
                            child.frustumCulled = false;
                            if ('holgura' in child.morphTargetDictionary) {
                                this.shirtMesh = child;
                                child.material.side = THREE.DoubleSide;
                            } else {
                                this.bodyMesh = child;
                            }
                        }
                    });
                    this.group.add(gltf.scene);
                    this.setColor(currentColor);
                    this.applyTargets(true); // aplicar estado inicial sin animación
                }, undefined, (error) => {
                    console.error('Error loading avatar_fit.glb:', error);
                });
            }
        }

        // Fija influencias objetivo. Mismo nombre de morph => cuerpo y polo se
        // mueven juntos (el polo con mayor amplitud, horneada en el GLB).
        setMorphs(vals) {
            Object.keys(vals).forEach(k => {
                if (k in this.targets) this.targets[k] = vals[k];
            });
        }

        applyToMesh(mesh, immediate) {
            if (!mesh || !mesh.morphTargetInfluences) return;
            const dict = mesh.morphTargetDictionary;
            Object.keys(this.targets).forEach(name => {
                if (!(name in dict)) return;
                const idx = dict[name];
                const cur = mesh.morphTargetInfluences[idx];
                const tgt = this.targets[name];
                // Interpolación suave => cambio "a tiempo real" fluido
                mesh.morphTargetInfluences[idx] = immediate ? tgt : cur + (tgt - cur) * 0.14;
            });
        }

        applyTargets(immediate) {
            this.applyToMesh(this.bodyMesh, immediate);
            this.applyToMesh(this.shirtMesh, immediate);
        }

        // Llamado cada frame desde el loop de animación
        tick() {
            this.applyTargets(false);
        }

        setColor(color) {
            const hexColor = color === 'white' ? 0xdddddd : 0x111111;
            if (this.shirtMesh && this.shirtMesh.material) {
                this.shirtMesh.material.color.setHex(hexColor);
            }
        }
    }

    function init3DScene(containerId, isModal) {
        const container = document.getElementById(containerId);
        if (!container) return null;

        const scene = new THREE.Scene();
        // Transparent background
        scene.background = null;

        const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.set(0, 1, 10);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.enablePan = false;
        controls.minDistance = 5;
        controls.maxDistance = 15;
        // Limit vertical rotation to not go under the floor
        controls.maxPolarAngle = Math.PI / 2 + 0.2;

        // Luces premium
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 5, 5);
        scene.add(dirLight);

        const fillLight = new THREE.DirectionalLight(0x90b0d0, 0.5);
        fillLight.position.set(-5, 0, -5);
        scene.add(fillLight);

        const mannequin = new Mannequin3D(scene, isModal);

        function animate() {
            requestAnimationFrame(animate);
            controls.update();
            mannequin.tick(); // interpola morphs => transiciones suaves
            renderer.render(scene, camera);
        }
        animate();

        // Handle resize
        window.addEventListener('resize', () => {
            if (container.clientWidth > 0) {
                camera.aspect = container.clientWidth / container.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(container.clientWidth, container.clientHeight);
            }
        });

        return mannequin;
    }

    let mainMannequin = null;
    let modalMannequin = null;

    // Iniciar escenas con timeout para asegurar que el DOM este listo
    setTimeout(() => {
        mainMannequin = init3DScene('main-3d-container', false);
        modalMannequin = init3DScene('modal-3d-container', true);
        if (mainMannequin) renderMainTshirt('M');
        if (modalMannequin) refreshModalPreview();
    }, 100);

    // ============================================================
    // SIZE DATA TABLE
    // ============================================================
    // holgura/largo = influencias de morph del polo (0 = ajustado al cuerpo).
    // El cuerpo NO cambia con la talla estándar: misma persona, distinta prenda.
    const SIZE_DATA = {
        'XS': { holgura: 0.00, largo: 0.00, ancho: '42 cm', largo_txt: '66 cm', holguraLabel: 'Slim', fitPos: 0.05 },
        'S': { holgura: 0.22, largo: 0.15, ancho: '46 cm', largo_txt: '69 cm', holguraLabel: 'Regular', fitPos: 0.22 },
        'M': { holgura: 0.45, largo: 0.32, ancho: '50 cm', largo_txt: '71 cm', holguraLabel: 'Regular', fitPos: 0.38 },
        'L': { holgura: 0.70, largo: 0.52, ancho: '54 cm', largo_txt: '74 cm', holguraLabel: 'Amplio', fitPos: 0.55 },
        'XL': { holgura: 0.95, largo: 0.72, ancho: '58 cm', largo_txt: '76 cm', holguraLabel: 'Amplio', fitPos: 0.72 },
        'personalizado': { holgura: 0.5, largo: 0.4, ancho: '—', largo_txt: '—', holguraLabel: '?', fitPos: 0.5 },
    };

    // Cuerpo base "promedio" para la vista principal
    const DEFAULT_BODY = { ancho: 0.35, altura: 0.3, hombros: 0.1, abdomen: 0.2, caidos: 0 };

    // Active selections
    let currentSize = 'M';
    let currentColor = 'white'; // Cambiado a blanco por defecto

    // ============================================================
    // QUANTITY BUTTONS
    // ============================================================
    const minusBtn = document.getElementById('minus-btn');
    const plusBtn = document.getElementById('plus-btn');
    const qtyInput = document.getElementById('qty-input');

    if (minusBtn && plusBtn && qtyInput) {
        minusBtn.addEventListener('click', () => {
            let v = parseInt(qtyInput.value);
            if (v > 1) qtyInput.value = v - 1;
        });
        plusBtn.addEventListener('click', () => {
            qtyInput.value = parseInt(qtyInput.value) + 1;
        });
    }

    // ============================================================
    // COLOR BUTTONS
    // ============================================================
    const colorBtns = document.querySelectorAll('.color-btn');
    const colorLabel = document.getElementById('color-label');

    colorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            colorBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (btn.classList.contains('black')) {
                if (colorLabel) colorLabel.textContent = 'NEGRO';
                currentColor = 'black';
            } else {
                if (colorLabel) colorLabel.textContent = 'BLANCO';
                currentColor = 'white';
            }
            renderMainTshirt(currentSize);
        });
    });

    // ============================================================
    // SIZE BUTTONS — main product page
    // ============================================================
    const sizeBtns = document.querySelectorAll('.size-btn');
    const sizeLabel = document.getElementById('size-label');
    const customModal = document.getElementById('custom-size-modal');

    sizeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const size = btn.getAttribute('data-size');
            if (size === 'personalizado') {
                sizeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (sizeLabel) sizeLabel.textContent = 'PERSONALIZADO';
                currentSize = 'personalizado';
                renderMainTshirt('personalizado');
                updatePreviewPanel('personalizado'); // FIX: también actualizar el panel
                const matchBadge = document.getElementById('match-badge');
                const mainMatchBadge = document.getElementById('main-match-badge');
                if (matchBadge) matchBadge.classList.add('hidden');
                if (mainMatchBadge) mainMatchBadge.classList.add('hidden');
                openModal(customModal);
                resetWizard();
                return;
            }
            sizeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSize = size;
            if (sizeLabel) sizeLabel.textContent = size;

            const matchBadge = document.getElementById('match-badge');
            const mainMatchBadge = document.getElementById('main-match-badge');
            if (matchBadge) matchBadge.classList.add('hidden');
            if (mainMatchBadge) mainMatchBadge.classList.add('hidden');

            renderMainTshirt(size);
            updatePreviewPanel(size);
        });
    });

    // ============================================================
    // RENDER MAIN TSHIRT 3D
    // ============================================================
    function renderMainTshirt(size) {
        if (!mainMannequin) return;
        mainMannequin.setColor(currentColor);

        const data = SIZE_DATA[size] || SIZE_DATA['M'];

        // Cuerpo promedio fijo; solo la prenda cambia con la talla.
        mainMannequin.setMorphs(Object.assign({}, DEFAULT_BODY, {
            holgura: data.holgura,
            largo: data.largo
        }));
    }

    // ============================================================
    // UPDATE PREVIEW PANEL (main product page)
    // ============================================================
    function updatePreviewPanel(size) {
        const data = SIZE_DATA[size] || SIZE_DATA['M'];

        // Badge
        const badge = document.getElementById('preview-badge');
        if (badge) badge.textContent = size === 'personalizado' ? 'CUSTOM' : size;

        // Metrics
        const mAncho = document.getElementById('metric-ancho');
        const mLargo = document.getElementById('metric-largo');
        const mHolgura = document.getElementById('metric-holgura');
        if (mAncho) mAncho.textContent = data.ancho;
        if (mLargo) mLargo.textContent = data.largo_txt;
        if (mHolgura) mHolgura.textContent = data.holguraLabel;

        // Fit bar
        const fill = document.getElementById('fit-bar-fill');
        const thumb = document.getElementById('fit-bar-thumb');
        const pct = data.fitPos * 100;
        if (fill) fill.style.width = `${pct}%`;
        if (thumb) thumb.style.left = `${pct}%`;

        // Chips
        const chipsEl = document.getElementById('size-chips');
        if (chipsEl) {
            if (size === 'personalizado') {
                chipsEl.innerHTML = '<span class="chip chip-custom">⚙ Talla a medida</span>';
            } else if (['XS', 'S'].includes(size)) {
                chipsEl.innerHTML = '<span class="chip chip-success">✓ Disponible</span><span class="chip chip-neutral">Fit ajustado</span>';
            } else if (['L', 'XL'].includes(size)) {
                chipsEl.innerHTML = '<span class="chip chip-success">✓ Disponible</span><span class="chip chip-neutral">Fit amplio</span>';
            } else {
                chipsEl.innerHTML = '<span class="chip chip-success">✓ Disponible</span><span class="chip chip-neutral">Talla estándar</span>';
            }
        }
    }

    // Initialize preview on load
    renderMainTshirt('M');
    updatePreviewPanel('M');

    // ============================================================
    // MODAL HELPERS
    // ============================================================
    const confeccionModal = document.getElementById('confeccion-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const closeConfeccionBtn = document.getElementById('close-confeccion');

    function openModal(modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        // Forzar un evento de 'resize' asíncrono para que el canvas de ThreeJS
        // recalcule su tamaño ahora que el modal (que antes era 0x0 por estar oculto) es visible.
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 50);
    }
    function closeModal(modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }

    closeModalBtn.addEventListener('click', () => {
        closeModal(customModal);
        // Revert to previous standard size if user cancels
        if (currentSize === 'personalizado') {
            sizeBtns.forEach(b => b.classList.remove('active'));
            const mBtn = document.getElementById('size-btn-M');
            if (mBtn) mBtn.classList.add('active');
            currentSize = 'M';
            sizeLabel.textContent = 'M';
            renderMainTshirt('M');
            updatePreviewPanel('M');
        }
    });

    closeConfeccionBtn.addEventListener('click', () => {
        closeModal(confeccionModal);
    });

    // Eventos para Guía de Tallas
    const sizeGuideLink = document.querySelector('.size-guide');
    const sizeGuideModal = document.getElementById('size-guide-modal');
    const closeGuideModalBtn = document.getElementById('close-guide-modal');
    const btnGuideToCustom = document.getElementById('btn-guide-to-custom');

    if (sizeGuideLink) {
        sizeGuideLink.addEventListener('click', (e) => {
            e.preventDefault();
            openModal(sizeGuideModal);
        });
    }

    if (closeGuideModalBtn) {
        closeGuideModalBtn.addEventListener('click', () => {
            closeModal(sizeGuideModal);
        });
    }

    if (btnGuideToCustom) {
        btnGuideToCustom.addEventListener('click', () => {
            closeModal(sizeGuideModal);
            // Simular click en el botón de Personalizado
            const customBtn = document.getElementById('size-btn-personalizado');
            if (customBtn) customBtn.click();
            else openModal(customModal);
        });
    }

    // Cerrar modales al hacer click fuera
    window.addEventListener('click', (e) => {
        if (e.target === customModal) closeModal(customModal);
        if (e.target === confeccionModal) closeModal(confeccionModal);
        if (e.target === sizeGuideModal) closeModal(sizeGuideModal);
        if (e.target === paymentModal) closeModal(paymentModal);
        if (e.target === successModal) closeModal(successModal);
    });

    // ============================================================
    // PAYMENT & CHECKOUT LOGIC
    // ============================================================
    const paymentModal = document.getElementById('payment-modal');
    const closePaymentBtn = document.getElementById('close-payment');
    const successModal = document.getElementById('success-modal');
    const btnCloseSuccess = document.getElementById('btn-close-success');
    
    // Botones que abren el checkout
    const btnBuyNowMain = document.querySelector('.btn-buy-now'); // Botón principal "COMPRAR AHORA"
    const btnBuyNowCustom = document.querySelector('.custom-buy-btn'); // Botón en el modal de confección

    if (btnBuyNowMain) {
        btnBuyNowMain.addEventListener('click', () => {
            openModal(paymentModal);
        });
    }

    if (btnBuyNowCustom) {
        btnBuyNowCustom.addEventListener('click', () => {
            closeModal(confeccionModal);
            openModal(paymentModal);
        });
    }

    if (closePaymentBtn) {
        closePaymentBtn.addEventListener('click', () => closeModal(paymentModal));
    }

    // Toggle Delivery form
    const deliveryRadios = document.querySelectorAll('input[name="delivery_method"]');
    const deliveryForm = document.getElementById('delivery-form');
    
    deliveryRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'delivery') {
                deliveryForm.classList.remove('hidden');
            } else {
                deliveryForm.classList.add('hidden');
            }
        });
    });

    // Pago completado
    const btnCompletePayment = document.getElementById('btn-complete-payment');
    if (btnCompletePayment) {
        btnCompletePayment.addEventListener('click', () => {
            closeModal(paymentModal);
            openModal(successModal);
        });
    }

    // Cerrar éxito y volver
    if (btnCloseSuccess) {
        btnCloseSuccess.addEventListener('click', () => {
            closeModal(successModal);
            // Opcional: resetear la selección de talla a M
            const mBtn = document.getElementById('size-btn-M');
            if (mBtn) mBtn.click();
        });
    }

    // ============================================================
    // WIZARD STATE
    // ============================================================
    const steps = document.querySelectorAll('.wizard-step');
    const nextBtns = document.querySelectorAll('.btn-next');
    const prevBtns = document.querySelectorAll('.btn-prev');
    const finishBtn = document.getElementById('btn-finish-wizard');
    const progressBar = document.getElementById('progress-bar');
    const wizardContainer = document.getElementById('wizard-container');
    const loadingContainer = document.getElementById('loading-container');

    let currentStep = 1;
    const totalSteps = 4;

    // Live wizard data
    const wizardData = {
        estatura: null, peso: null, edad: null,
        torso: null, abdomen: null, holgura: null
    };

    // ============================================================
    // WIZARD NAVIGATION
    // ============================================================
    function updateWizard() {
        steps.forEach(s => s.classList.add('hidden'));
        const el = document.getElementById(`step-${currentStep}`);
        if (el) el.classList.remove('hidden');
        const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;
        progressBar.style.width = `${progress}%`;
    }

    nextBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (currentStep < totalSteps) {
                currentStep++;
                updateWizard();
            }
        });
    });

    prevBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (currentStep > 1) {
                currentStep--;
                updateWizard();
            }
        });
    });

    function resetWizard() {
        currentStep = 1;
        document.getElementById('w-estatura').value = '';
        document.getElementById('w-peso').value = '';
        document.getElementById('w-edad').value = '';
        document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
        document.querySelectorAll('.radio-option').forEach(l => l.classList.remove('selected'));
        wizardData.estatura = null; wizardData.peso = null; wizardData.edad = null;
        wizardData.torso = null; wizardData.abdomen = null; wizardData.holgura = null;
        wizardContainer.classList.remove('hidden');
        loadingContainer.classList.add('hidden');
        updateWizard();
        refreshModalPreview();
    }

    // ============================================================
    // LIVE INPUT LISTENERS — step 1
    // ============================================================
    const wEstatura = document.getElementById('w-estatura');
    const wPeso = document.getElementById('w-peso');
    const wEdad = document.getElementById('w-edad');

    [wEstatura, wPeso, wEdad].forEach(input => {
        input.addEventListener('input', () => {
            wizardData.estatura = parseInt(wEstatura.value) || null;
            wizardData.peso = parseInt(wPeso.value) || null;
            wizardData.edad = parseInt(wEdad.value) || null;
            refreshModalPreview();
        });
    });

    // ============================================================
    // RADIO OPTION LIVE LISTENERS
    // ============================================================
    document.querySelectorAll('.radio-option').forEach(label => {
        label.addEventListener('click', () => {
            const name = label.getAttribute('data-name');
            const val = label.getAttribute('data-val');
            if (!name || !val) return;

            // Highlight selected
            document.querySelectorAll(`.radio-option[data-name="${name}"]`).forEach(l => l.classList.remove('selected'));
            label.classList.add('selected');

            wizardData[name] = val;
            refreshModalPreview();
        });
    });

    // ============================================================
    // COMPUTE ESTIMATED SIZE FROM WIZARD DATA
    // ============================================================
    function computeEstimatedSize() {
        const sizeMap = ['XS', 'S', 'M', 'L', 'XL'];
        let idx = 2; // default M

        const peso = wizardData.peso || 70;
        if (peso < 60) idx = 0;
        else if (peso <= 70) idx = 1;
        else if (peso <= 80) idx = 2;
        else if (peso <= 95) idx = 3;
        else idx = 4;

        const estatura = wizardData.estatura || 170;
        if (estatura > 185 && idx < 2) idx++;

        if (wizardData.torso === 'anchos') idx += 0.5;
        if (wizardData.abdomen === 'robusto') idx += 1;

        const holgura = wizardData.holgura;
        if (holgura === 'oversize') idx += 1;
        else if (holgura === 'extreme') idx += 2;

        const finalIdx = Math.floor(idx);
        const needsConfeccion = finalIdx > 4 || (peso >= 120 && finalIdx >= 4 && holgura !== 'moderado');
        if (needsConfeccion) return { size: 'CONF.', needsConfeccion: true, finalIdx };

        return { size: sizeMap[Math.min(finalIdx, 4)], needsConfeccion: false, finalIdx };
    }

    // ============================================================
    // COMPUTE FIT POSITION FROM WIZARD DATA
    // ============================================================
    function computeFitPos() {
        const holgura = wizardData.holgura;
        if (!holgura) return 0.38; // default M
        if (holgura === 'moderado') return 0.25;
        if (holgura === 'oversize') return 0.65;
        if (holgura === 'extreme') return 0.92;
        return 0.38;
    }

    // ============================================================
    // WIZARD DATA -> MORPH INFLUENCES (cuerpo + prenda a la vez)
    // ============================================================
    function computeWizardMorphs() {
        const peso = wizardData.peso || 70;
        const estatura = wizardData.estatura || 170;

        const clamp01 = (v) => Math.min(Math.max(v, 0), 1);

        // Cuerpo: continuo, cada tecla del usuario se refleja al instante
        const ancho = clamp01((peso - 55) / 50);          // 55kg=0 .. 105kg=1
        const altura = clamp01((estatura - 158) / 34);    // 158cm=0 .. 192cm=1

        let hombros = 0.1, caidos = 0;
        if (wizardData.torso === 'anchos') hombros = 1;
        if (wizardData.torso === 'atleticos') hombros = 0.45;
        if (wizardData.torso === 'caidos') { hombros = 0; caidos = 1; }

        let abdomen = 0.25;
        if (wizardData.abdomen === 'plano') abdomen = 0;
        if (wizardData.abdomen === 'robusto') abdomen = 1;

        // Prenda: nivel de holgura elegido
        let holgura = 0.45, largo = 0.32;
        if (wizardData.holgura === 'moderado') { holgura = 0.35; largo = 0.25; }
        if (wizardData.holgura === 'oversize') { holgura = 0.8; largo = 0.6; }
        if (wizardData.holgura === 'extreme') { holgura = 1.15; largo = 0.9; }

        return { ancho, altura, hombros, caidos, abdomen, holgura, largo };
    }

    // ============================================================
    // RENDER MODAL 3D (cuerpo y polo comparten morphs => nunca se traspasan)
    // ============================================================
    function renderModalTshirt(morphs) {
        if (!modalMannequin) return;
        modalMannequin.setColor(currentColor);
        modalMannequin.setMorphs(morphs);
    }

    // ============================================================
    // REFRESH MODAL PREVIEW (runs on every wizard input change)
    // ============================================================
    function refreshModalPreview() {
        // 1. Live stats rows
        updateLiveStat('live-estatura', wizardData.estatura ? wizardData.estatura + ' cm' : '—', !!wizardData.estatura);
        updateLiveStat('live-peso', wizardData.peso ? wizardData.peso + ' kg' : '—', !!wizardData.peso);
        updateLiveStat('live-torso', wizardData.torso ? capitalize(wizardData.torso) : '—', !!wizardData.torso);
        updateLiveStat('live-abdomen', wizardData.abdomen ? capitalize(wizardData.abdomen) : '—', !!wizardData.abdomen);
        updateLiveStat('live-holgura', wizardData.holgura ? capitalize(wizardData.holgura) : '—', !!wizardData.holgura);

        // 2. Estimated size badge
        const est = computeEstimatedSize();
        const predBadge = document.getElementById('predicted-badge');
        if (predBadge) predBadge.textContent = est.size;

        // 3. Fit bar
        const fitPos = computeFitPos();
        const mFill = document.getElementById('modal-fit-bar-fill');
        const mThumb = document.getElementById('modal-fit-bar-thumb');
        if (mFill) mFill.style.width = `${fitPos * 100}%`;
        if (mThumb) mThumb.style.left = `${fitPos * 100}%`;

        // 4. Avatar 3D: cuerpo + prenda actualizados en un solo paso
        renderModalTshirt(computeWizardMorphs());
    }

    function updateLiveStat(id, text, filled) {
        const valEl = document.getElementById(id);
        if (!valEl) return;
        valEl.textContent = text;
        const row = valEl.closest('.live-stat-row');
        if (row) row.classList.toggle('filled', filled);
    }

    function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // ============================================================
    // FINISH WIZARD
    // ============================================================
    finishBtn.addEventListener('click', () => {
        const estatura = parseInt(wEstatura.value) || 170;
        const peso = parseInt(wPeso.value) || 70;

        wizardData.estatura = estatura;
        wizardData.peso = peso;
        // FIX: Safe optional chaining — avoid {}.value undefined-then-fallback ambiguity
        const torsoEl = document.querySelector('input[name="torso"]:checked');
        const abdomenEl = document.querySelector('input[name="abdomen"]:checked');
        const holguraEl = document.querySelector('input[name="holgura"]:checked');
        wizardData.torso = torsoEl ? torsoEl.value : 'atleticos';
        wizardData.abdomen = abdomenEl ? abdomenEl.value : 'promedio';
        wizardData.holgura = holguraEl ? holguraEl.value : 'moderado';

        wizardContainer.classList.add('hidden');
        loadingContainer.classList.remove('hidden');

        // Secuencia simulada de Machine Learning y Fabric Drape
        const loadingText = document.getElementById('loading-text');
        if (loadingText) loadingText.textContent = 'Analizando anatomía y biometría...';

        setTimeout(() => {
            if (loadingText) loadingText.textContent = 'Procesando modelo de Machine Learning con historial de compras...';
        }, 800);

        setTimeout(() => {
            if (loadingText) loadingText.textContent = 'Simulando caída de tela (gramaje)...';
        }, 1600);

        setTimeout(() => {
            closeModal(customModal);

            const sizeMap = ['XS', 'S', 'M', 'L', 'XL'];
            let idx = 2;
            if (peso < 60) idx = 0;
            else if (peso <= 70) idx = 1;
            else if (peso <= 80) idx = 2;
            else if (peso <= 95) idx = 3;
            else idx = 4;

            if (estatura > 185 && idx < 2) idx++;
            if (wizardData.torso === 'anchos') idx += 0.5;
            if (wizardData.abdomen === 'robusto') idx += 1;
            if (wizardData.holgura === 'oversize') idx += 1;
            else if (wizardData.holgura === 'extreme') idx += 2;

            const finalIdx = Math.floor(idx);
            const needsConfeccion = finalIdx > 4 || (peso >= 120 && finalIdx >= 4 && wizardData.holgura !== 'moderado');

            if (needsConfeccion) {
                setTimeout(() => openModal(confeccionModal), 300);
            } else {
                const finalSize = sizeMap[Math.min(finalIdx, 4)];
                // Activate the corresponding size button
                sizeBtns.forEach(b => b.classList.remove('active'));
                const targetBtn = document.getElementById(`size-btn-${finalSize}`);
                if (targetBtn) {
                    targetBtn.classList.add('active');
                    // FIX: removed unused originalText variable
                    targetBtn.textContent = `${finalSize} ✓`;
                    setTimeout(() => { targetBtn.textContent = finalSize; }, 3000);
                }
                currentSize = finalSize;
                if (sizeLabel) {
                    sizeLabel.textContent = `${finalSize} (Tu Talla Sugerida)`;
                    setTimeout(() => { sizeLabel.textContent = finalSize; }, 3500);
                }

                // Generar porcentaje de Match
                const matchPct = Math.floor(Math.random() * (98 - 91 + 1)) + 91;
                const matchBadge = document.getElementById('match-badge');
                const mainMatchBadge = document.getElementById('main-match-badge');
                if (matchBadge) {
                    matchBadge.textContent = `${matchPct}% Match`;
                    matchBadge.classList.remove('hidden');
                }
                if (mainMatchBadge) {
                    mainMatchBadge.textContent = `${matchPct}% Match`;
                    mainMatchBadge.classList.remove('hidden');
                }

                renderMainTshirt(finalSize);
                updatePreviewPanel(finalSize);
            }
        }, 2400);
    });



});
